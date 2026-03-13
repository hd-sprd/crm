import client from './client'

export const importApi = {
  importSalesforce: (objectType, file, onProgress) => {
    const form = new FormData()
    form.append('file', file)
    return client.post('/import/salesforce', form, {
      params: { object_type: objectType },
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: onProgress,
    }).then(r => r.data)
  },
}
