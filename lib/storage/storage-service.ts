/**
 * lib/storage/storage-service.ts
 *
 * Service de haut niveau pour la GED d'Oraforme.
 * Gère : upload, download, archive, restore, delete, versioning, historique.
 *
 * Chaque document est : horodaté, versionné, traçable.
 */

import { supabaseAdmin } from '@/lib/supabase-server'
import { createStorageProvider, StorageProvider } from './storage-provider'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabaseAdmin as any

// ── Types ──────────────────────────────────────────────────────────────────────

export type DocCategory =
  | 'cv' | 'contrat' | 'facture' | 'devis' | 'bulletin'
  | 'cnss' | 'fiscal' | 'photo' | 'cabinet' | 'hotel'
  | 'ecole' | 'clinique' | 'autre'

export interface UploadDocumentOpts {
  tenantId:     string
  file:         Buffer
  filename:     string
  mimeType:     string
  category:     DocCategory
  nom?:         string
  dossierId?:   string
  tags?:        string[]
  confidentiel?: boolean
  userId?:      string
  userName?:    string
  note?:        string
}

export interface DocumentRecord {
  id:               string
  tenant_id:        string
  nom:              string
  url:              string
  storage_key:      string
  storage_provider: string
  storage_bucket:   string
  mime_type:        string
  file_size:        number
  checksum:         string
  categorie:        string
  version:          number
  statut:           string
  ocr_status:       string
  created_at:       string
}

// ── History helper ─────────────────────────────────────────────────────────────

async function logHistory(
  documentId: string,
  tenantId:   string,
  action:     string,
  userId?:    string,
  userName?:  string,
  metadata:   Record<string, unknown> = {},
) {
  await db.from('document_history').insert({
    document_id: documentId,
    tenant_id:   tenantId,
    action,
    user_id:     userId  ?? null,
    user_name:   userName ?? null,
    metadata,
  })
}

// ── UPLOAD ─────────────────────────────────────────────────────────────────────

export async function uploadDocument(opts: UploadDocumentOpts): Promise<{
  ok: boolean; document?: DocumentRecord; error?: string
}> {
  const storage = await createStorageProvider(opts.tenantId)
  const key     = StorageProvider.generateKey(opts.tenantId, opts.category, opts.filename)

  // Upload fichier
  const uploadRes = await storage.upload(key, opts.file, opts.mimeType)
  if (!uploadRes.ok) return { ok: false, error: uploadRes.error }

  // Insérer métadonnées dans documents
  const { data: doc, error: dbErr } = await db
    .from('documents')
    .insert({
      tenant_id:        opts.tenantId,
      nom:              opts.nom || opts.filename,
      url:              uploadRes.url,
      storage_key:      key,
      storage_provider: uploadRes.provider,
      storage_bucket:   uploadRes.bucket,
      mime_type:        opts.mimeType,
      file_size:        opts.file.length,
      checksum:         uploadRes.checksum,
      categorie:        opts.category,
      type:             opts.category,
      tags:             opts.tags ?? [],
      confidentiel:     opts.confidentiel ?? false,
      statut:           'actif',
      ocr_status:       'pending',
      version:          1,
      dossier_id:       opts.dossierId ?? null,
    })
    .select('*')
    .single()

  if (dbErr) return { ok: false, error: dbErr.message }

  // Créer version initiale
  await db.from('document_versions').insert({
    document_id:      doc.id,
    tenant_id:        opts.tenantId,
    version:          1,
    storage_key:      key,
    storage_provider: uploadRes.provider,
    storage_bucket:   uploadRes.bucket,
    file_size:        opts.file.length,
    mime_type:        opts.mimeType,
    checksum:         uploadRes.checksum,
    nom:              opts.nom || opts.filename,
    created_by:       opts.userId ?? null,
    note:             opts.note ?? 'Version initiale',
  })

  // Historique
  await logHistory(doc.id, opts.tenantId, 'upload', opts.userId, opts.userName, {
    filename: opts.filename,
    size:     opts.file.length,
    provider: uploadRes.provider,
  })

  return { ok: true, document: doc as DocumentRecord }
}

// ── DOWNLOAD (presigned URL) ───────────────────────────────────────────────────

export async function downloadDocument(
  documentId: string,
  tenantId:   string,
  userId?:    string,
  userName?:  string,
): Promise<{ ok: boolean; url?: string; expiresIn?: number; error?: string }> {
  const { data: doc } = await db
    .from('documents')
    .select('storage_key,storage_provider,url,nom')
    .eq('id', documentId)
    .eq('tenant_id', tenantId)
    .maybeSingle()

  if (!doc) return { ok: false, error: 'Document introuvable' }

  await logHistory(documentId, tenantId, 'download', userId, userName)

  // Si URL publique déjà stockée (Supabase public), retourner directement
  if (doc.storage_provider === 'supabase') {
    return { ok: true, url: doc.url }
  }

  // Générer presigned URL S3
  const storage = await createStorageProvider(tenantId)
  const res = await storage.presignDownload(doc.storage_key, 3600)
  if (!res.ok) return { ok: false, error: res.error }
  return { ok: true, url: res.url, expiresIn: res.expiresIn }
}

// ── ARCHIVE ────────────────────────────────────────────────────────────────────

export async function archiveDocument(
  documentId: string,
  tenantId:   string,
  userId?:    string,
  userName?:  string,
): Promise<{ ok: boolean; error?: string }> {
  const { error } = await db
    .from('documents')
    .update({ statut: 'archive' })
    .eq('id', documentId)
    .eq('tenant_id', tenantId)

  if (error) return { ok: false, error: error.message }
  await logHistory(documentId, tenantId, 'archive', userId, userName)
  return { ok: true }
}

// ── RESTORE ────────────────────────────────────────────────────────────────────

export async function restoreDocument(
  documentId: string,
  tenantId:   string,
  userId?:    string,
  userName?:  string,
): Promise<{ ok: boolean; error?: string }> {
  const { error } = await db
    .from('documents')
    .update({ statut: 'actif' })
    .eq('id', documentId)
    .eq('tenant_id', tenantId)

  if (error) return { ok: false, error: error.message }
  await logHistory(documentId, tenantId, 'restore', userId, userName)
  return { ok: true }
}

// ── DELETE (soft delete) ───────────────────────────────────────────────────────

export async function deleteDocument(
  documentId: string,
  tenantId:   string,
  hard    = false,
  userId?:    string,
  userName?:  string,
): Promise<{ ok: boolean; error?: string }> {
  if (hard) {
    // Récupérer la clé pour supprimer le fichier réel
    const { data: doc } = await db
      .from('documents')
      .select('storage_key,storage_provider,storage_bucket')
      .eq('id', documentId)
      .eq('tenant_id', tenantId)
      .maybeSingle()

    if (doc?.storage_key) {
      const storage = await createStorageProvider(tenantId)
      await storage.delete(doc.storage_key, doc.storage_bucket)
    }

    await logHistory(documentId, tenantId, 'delete_hard', userId, userName)
    const { error } = await db.from('documents').delete().eq('id', documentId).eq('tenant_id', tenantId)
    if (error) return { ok: false, error: error.message }
  } else {
    const { error } = await db
      .from('documents')
      .update({ statut: 'supprime' })
      .eq('id', documentId)
      .eq('tenant_id', tenantId)
    if (error) return { ok: false, error: error.message }
    await logHistory(documentId, tenantId, 'delete', userId, userName)
  }
  return { ok: true }
}

// ── VERSIONING — nouvelle version d'un document existant ─────────────────────

export async function addDocumentVersion(
  documentId: string,
  opts: Omit<UploadDocumentOpts, 'category' | 'dossierId' | 'tags' | 'confidentiel'>,
): Promise<{ ok: boolean; version?: number; error?: string }> {
  const { data: existing } = await db
    .from('documents')
    .select('version,storage_key,categorie')
    .eq('id', documentId)
    .eq('tenant_id', opts.tenantId)
    .maybeSingle()

  if (!existing) return { ok: false, error: 'Document introuvable' }

  const newVersion = (existing.version ?? 1) + 1
  const storage    = await createStorageProvider(opts.tenantId)
  const key        = StorageProvider.generateKey(opts.tenantId, existing.categorie, opts.filename)

  const uploadRes  = await storage.upload(key, opts.file, opts.mimeType)
  if (!uploadRes.ok) return { ok: false, error: uploadRes.error }

  // Mettre à jour le document principal
  await db.from('documents').update({
    url:              uploadRes.url,
    storage_key:      key,
    storage_provider: uploadRes.provider,
    storage_bucket:   uploadRes.bucket,
    file_size:        opts.file.length,
    checksum:         uploadRes.checksum,
    version:          newVersion,
    ocr_status:       'pending',
  }).eq('id', documentId).eq('tenant_id', opts.tenantId)

  // Enregistrer la nouvelle version
  await db.from('document_versions').insert({
    document_id:      documentId,
    tenant_id:        opts.tenantId,
    version:          newVersion,
    storage_key:      key,
    storage_provider: uploadRes.provider,
    storage_bucket:   uploadRes.bucket,
    file_size:        opts.file.length,
    mime_type:        opts.mimeType,
    checksum:         uploadRes.checksum,
    nom:              opts.filename,
    created_by:       opts.userId ?? null,
    note:             opts.note ?? `Version ${newVersion}`,
  })

  await logHistory(documentId, opts.tenantId, 'update', opts.userId, opts.userName, {
    new_version: newVersion,
    filename:    opts.filename,
  })

  return { ok: true, version: newVersion }
}

// ── GET VERSIONS ───────────────────────────────────────────────────────────────

export async function getDocumentVersions(documentId: string, tenantId: string) {
  const { data } = await db
    .from('document_versions')
    .select('*')
    .eq('document_id', documentId)
    .eq('tenant_id', tenantId)
    .order('version', { ascending: false })

  return data ?? []
}

// ── GET HISTORY ────────────────────────────────────────────────────────────────

export async function getDocumentHistory(documentId: string, tenantId: string) {
  const { data } = await db
    .from('document_history')
    .select('*')
    .eq('document_id', documentId)
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .limit(100)

  return data ?? []
}

// ── SEARCH (full-text + filters) ──────────────────────────────────────────────

export async function searchDocuments(
  tenantId: string,
  query:    string,
  filters?: {
    category?: DocCategory
    statut?:   string
    dateFrom?: string
    dateTo?:   string
  },
): Promise<DocumentRecord[]> {
  let q = db
    .from('documents')
    .select('id,nom,url,categorie,mime_type,file_size,statut,ocr_status,version,created_at,tags,ocr_text')
    .eq('tenant_id', tenantId)
    .neq('statut', 'supprime')
    .order('created_at', { ascending: false })
    .limit(50)

  if (filters?.category) q = q.eq('categorie', filters.category)
  if (filters?.statut)   q = q.eq('statut', filters.statut)
  if (filters?.dateFrom) q = q.gte('created_at', filters.dateFrom)
  if (filters?.dateTo)   q = q.lte('created_at', filters.dateTo)

  if (query.trim()) {
    // FTS sur ocr_text (GIN index) + ILIKE sur nom
    const safe = query.trim().replace(/[%_'"\\]/g, ' ')
    q = q.or(`nom.ilike.%${safe}%,ocr_text.plfts(french).${safe}`)
  }

  const { data } = await q
  return data ?? []
}

// ── PRESIGN for direct client upload ─────────────────────────────────────────

export async function presignUpload(
  tenantId: string,
  category: DocCategory,
  filename: string,
  mimeType: string,
): Promise<{ ok: boolean; url?: string; key?: string; error?: string }> {
  const storage = await createStorageProvider(tenantId)
  const key     = StorageProvider.generateKey(tenantId, category, filename)
  const res     = await storage.presignUpload(key, mimeType)
  if (!res.ok) return { ok: false, error: res.error }
  return { ok: true, url: res.url, key }
}
