// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require('pdf-parse')
// eslint-disable-next-line @typescript-eslint/no-require-imports
const mammoth = require('mammoth')

export async function parseCV(buffer: Buffer, filename: string): Promise<string> {
  const ext = filename.split('.').pop()?.toLowerCase() ?? ''

  if (ext === 'pdf') {
    const data = await pdfParse(buffer)
    return (data.text as string).trim()
  }

  if (ext === 'docx' || ext === 'doc') {
    const result = await mammoth.extractRawText({ buffer })
    return (result.value as string).trim()
  }

  if (['jpg', 'jpeg', 'png', 'webp', 'bmp', 'tiff', 'tif'].includes(ext)) {
    const { createWorker } = await import('tesseract.js')
    const worker = await createWorker(['fra', 'eng'])
    const { data: { text } } = await worker.recognize(buffer)
    await worker.terminate()
    return text.trim()
  }

  // Fallback: try UTF-8 text
  return buffer.toString('utf-8').trim()
}
