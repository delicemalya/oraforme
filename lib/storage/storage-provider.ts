/**
 * lib/storage/storage-provider.ts
 *
 * Abstraction S3-compatible pour AWS S3, Cloudflare R2, Wasabi, MinIO.
 * Si aucun config S3 n'est trouvé, bascule automatiquement sur Supabase Storage.
 *
 * Presets endpoint :
 *   AWS S3      : https://s3.{region}.amazonaws.com
 *   Cloudflare R2 : https://{account-id}.r2.cloudflarestorage.com
 *   Wasabi      : https://s3.{region}.wasabisys.com
 *   MinIO       : http://localhost:9000 (ou votre host)
 */

import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  CopyObjectCommand,
  HeadObjectCommand,
  ListObjectVersionsCommand,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { Upload } from '@aws-sdk/lib-storage'
import { supabaseAdmin } from '@/lib/supabase-server'
import crypto from 'crypto'

// ── Types ──────────────────────────────────────────────────────────────────────

export type StorageProviderType = 's3' | 'r2' | 'wasabi' | 'minio' | 'supabase'

export interface StorageConfig {
  provider:     StorageProviderType
  endpoint:     string
  bucket:       string
  region:       string
  accessKey:    string
  secretKey:    string
  publicUrl?:   string
}

export interface UploadResult {
  ok:           boolean
  key:          string
  url:          string
  provider:     StorageProviderType
  bucket:       string
  checksum?:    string
  error?:       string
}

export interface DownloadResult {
  ok:           boolean
  url:          string        // Presigned URL (S3) ou public URL (Supabase)
  expiresIn?:   number        // secondes
  error?:       string
}

export interface DeleteResult {
  ok:     boolean
  error?: string
}

export interface VersionInfo {
  versionId:  string
  lastModified: Date
  size:       number
  isLatest:   boolean
}

// ── StorageProvider class ─────────────────────────────────────────────────────

export class StorageProvider {
  private cfg: StorageConfig | null = null
  private s3:  S3Client | null = null
  private tenantId: string

  constructor(tenantId: string) {
    this.tenantId = tenantId
  }

  // ── Load config from DB ────────────────────────────────────────────────────

  async init(): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabaseAdmin as any
    const { data } = await db
      .from('storage_configs')
      .select('provider,s3_endpoint,s3_bucket,s3_region,s3_access_key,s3_secret_key,public_url,actif')
      .eq('tenant_id', this.tenantId)
      .maybeSingle()

    if (data?.actif && data.s3_access_key && data.s3_secret_key && data.s3_bucket) {
      this.cfg = {
        provider:   data.provider as StorageProviderType,
        endpoint:   data.s3_endpoint || this.defaultEndpoint(data.provider, data.s3_region),
        bucket:     data.s3_bucket,
        region:     data.s3_region || 'auto',
        accessKey:  data.s3_access_key,
        secretKey:  data.s3_secret_key,
        publicUrl:  data.public_url || undefined,
      }

      this.s3 = new S3Client({
        region:   this.cfg.region,
        endpoint: this.cfg.endpoint,
        credentials: {
          accessKeyId:     this.cfg.accessKey,
          secretAccessKey: this.cfg.secretKey,
        },
        forcePathStyle: data.provider === 'minio',  // MinIO requiert path-style
      })
    }
  }

  private defaultEndpoint(provider: string, region: string): string {
    switch (provider) {
      case 'wasabi': return `https://s3.${region || 'eu-west-1'}.wasabisys.com`
      case 'r2':     return `https://auto.r2.cloudflarestorage.com`
      case 'minio':  return 'http://localhost:9000'
      default:       return `https://s3.${region || 'us-east-1'}.amazonaws.com`
    }
  }

  get isS3(): boolean { return this.s3 !== null && this.cfg !== null }
  get provider(): StorageProviderType { return this.cfg?.provider ?? 'supabase' }

  // ── Generate storage key ───────────────────────────────────────────────────

  static generateKey(tenantId: string, category: string, filename: string): string {
    const date  = new Date().toISOString().split('T')[0].replace(/-/g, '/')
    const safe  = filename.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 100)
    const uid   = crypto.randomBytes(6).toString('hex')
    return `${tenantId}/${category}/${date}/${uid}_${safe}`
  }

  static checksum(buffer: Buffer): string {
    return crypto.createHash('sha256').update(buffer).digest('hex').slice(0, 16)
  }

  // ── UPLOAD ─────────────────────────────────────────────────────────────────

  async upload(
    key:      string,
    buffer:   Buffer,
    mimeType: string,
    metadata: Record<string, string> = {},
  ): Promise<UploadResult> {
    if (this.isS3 && this.s3 && this.cfg) {
      try {
        const upload = new Upload({
          client: this.s3,
          params: {
            Bucket:      this.cfg.bucket,
            Key:         key,
            Body:        buffer,
            ContentType: mimeType,
            Metadata:    metadata,
          },
        })
        await upload.done()

        const url = this.cfg.publicUrl
          ? `${this.cfg.publicUrl.replace(/\/$/, '')}/${key}`
          : await this.presignDownload(key, 3600 * 24 * 7)

        return {
          ok:       true,
          key,
          url:      url.url || '',
          provider: this.cfg.provider,
          bucket:   this.cfg.bucket,
          checksum: StorageProvider.checksum(buffer),
        }
      } catch (err) {
        return { ok: false, key, url: '', provider: this.cfg.provider, bucket: this.cfg.bucket, error: (err as Error).message }
      }
    }

    // Fallback Supabase Storage
    return this.uploadSupabase(key, buffer, mimeType)
  }

  private async uploadSupabase(key: string, buffer: Buffer, mimeType: string): Promise<UploadResult> {
    const bucket = 'documents'
    const { error } = await supabaseAdmin.storage.from(bucket).upload(key, buffer, {
      contentType: mimeType,
      upsert: false,
    })
    if (error) return { ok: false, key, url: '', provider: 'supabase', bucket, error: error.message }
    const { data: { publicUrl } } = supabaseAdmin.storage.from(bucket).getPublicUrl(key)
    return { ok: true, key, url: publicUrl, provider: 'supabase', bucket, checksum: StorageProvider.checksum(buffer) }
  }

  // ── PRESIGN DOWNLOAD ───────────────────────────────────────────────────────

  async presignDownload(key: string, expiresIn = 3600): Promise<DownloadResult> {
    if (this.isS3 && this.s3 && this.cfg) {
      try {
        const url = await getSignedUrl(
          this.s3,
          new GetObjectCommand({ Bucket: this.cfg.bucket, Key: key }),
          { expiresIn },
        )
        return { ok: true, url, expiresIn }
      } catch (err) {
        return { ok: false, url: '', error: (err as Error).message }
      }
    }
    // Supabase public URL
    const { data: { publicUrl } } = supabaseAdmin.storage.from('documents').getPublicUrl(key)
    return { ok: true, url: publicUrl }
  }

  // ── PRESIGN UPLOAD (client-side direct upload) ─────────────────────────────

  async presignUpload(key: string, mimeType: string, expiresIn = 3600): Promise<{ ok: boolean; url: string; fields?: Record<string, string>; error?: string }> {
    if (this.isS3 && this.s3 && this.cfg) {
      try {
        const url = await getSignedUrl(
          this.s3,
          new PutObjectCommand({ Bucket: this.cfg.bucket, Key: key, ContentType: mimeType }),
          { expiresIn },
        )
        return { ok: true, url }
      } catch (err) {
        return { ok: false, url: '', error: (err as Error).message }
      }
    }
    // Supabase Storage upload URL
    const { data, error } = await supabaseAdmin.storage.from('documents').createSignedUploadUrl(key)
    if (error) return { ok: false, url: '', error: error.message }
    return { ok: true, url: data.signedUrl }
  }

  // ── DELETE ─────────────────────────────────────────────────────────────────

  async delete(key: string, bucket?: string): Promise<DeleteResult> {
    if (this.isS3 && this.s3 && this.cfg) {
      try {
        await this.s3.send(new DeleteObjectCommand({ Bucket: this.cfg.bucket, Key: key }))
        return { ok: true }
      } catch (err) {
        return { ok: false, error: (err as Error).message }
      }
    }
    const b = bucket || 'documents'
    const { error } = await supabaseAdmin.storage.from(b).remove([key])
    if (error) return { ok: false, error: error.message }
    return { ok: true }
  }

  // ── COPY (utilisé pour archive) ────────────────────────────────────────────

  async copy(srcKey: string, destKey: string): Promise<{ ok: boolean; error?: string }> {
    if (this.isS3 && this.s3 && this.cfg) {
      try {
        await this.s3.send(new CopyObjectCommand({
          Bucket:     this.cfg.bucket,
          CopySource: `${this.cfg.bucket}/${srcKey}`,
          Key:        destKey,
        }))
        return { ok: true }
      } catch (err) {
        return { ok: false, error: (err as Error).message }
      }
    }
    return { ok: false, error: 'copy not supported for Supabase Storage' }
  }

  // ── VERSIONS (S3 versioning) ───────────────────────────────────────────────

  async listVersions(key: string): Promise<VersionInfo[]> {
    if (this.isS3 && this.s3 && this.cfg) {
      try {
        const res = await this.s3.send(new ListObjectVersionsCommand({
          Bucket: this.cfg.bucket,
          Prefix: key,
        }))
        return (res.Versions ?? []).map(v => ({
          versionId:    v.VersionId ?? '',
          lastModified: v.LastModified ?? new Date(),
          size:         v.Size ?? 0,
          isLatest:     v.IsLatest ?? false,
        }))
      } catch { return [] }
    }
    return []
  }

  // ── FILE EXISTS ────────────────────────────────────────────────────────────

  async exists(key: string): Promise<boolean> {
    if (this.isS3 && this.s3 && this.cfg) {
      try {
        await this.s3.send(new HeadObjectCommand({ Bucket: this.cfg.bucket, Key: key }))
        return true
      } catch { return false }
    }
    const { data } = await supabaseAdmin.storage.from('documents').list(key.split('/').slice(0, -1).join('/'))
    return (data ?? []).some(f => f.name === key.split('/').pop())
  }
}

// ── Factory ───────────────────────────────────────────────────────────────────

export async function createStorageProvider(tenantId: string): Promise<StorageProvider> {
  const p = new StorageProvider(tenantId)
  await p.init()
  return p
}
