import client from './client'

export const importApi = {
  preview: (objectType, file) => {
    const form = new FormData()
    form.append('file', file)
    return client.post('/import/preview', form, {
      params: { object_type: objectType },
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then(r => r.data)
  },

  importSalesforce: (objectType, file, fieldMapping, onProgress) => {
    const form = new FormData()
    form.append('file', file)
    if (fieldMapping) {
      form.append('field_mapping', JSON.stringify(fieldMapping))
    }
    return client.post('/import/salesforce', form, {
      params: { object_type: objectType },
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: onProgress,
    }).then(r => r.data)
  },
}
