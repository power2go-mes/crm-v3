const attachmentLimit = 10 * 1024 * 1024;

export function leadAttachmentPath(leadId: string, file: File, operationId: string) {
  if (file.size > attachmentLimit) throw new Error('Files must be 10 MB or smaller.');
  const safeName = file.name.normalize('NFKC').replace(/[^a-zA-Z0-9_. -]/g, '_').slice(0, 150) || 'attachment';
  return `${leadId}/${operationId}_${safeName}`;
}
