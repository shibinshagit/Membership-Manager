type PostFormDataResult<T = unknown> = {
  ok: boolean;
  status: number;
  data: T;
};

type PostFormDataOptions = {
  onUploadProgress?: (percent: number) => void;
  onProcessing?: () => void;
  /** Total request timeout in ms (upload + server processing). Default 120s. */
  timeoutMs?: number;
};

export function postFormDataWithProgress<T = unknown>(
  url: string,
  formData: FormData,
  options: PostFormDataOptions = {}
): Promise<PostFormDataResult<T>> {
  const { onUploadProgress, onProcessing, timeoutMs = 120_000 } = options;

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', url);
    xhr.timeout = timeoutMs;

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && onUploadProgress) {
        onUploadProgress(Math.round((event.loaded / event.total) * 100));
      }
    };

    xhr.upload.onload = () => {
      onProcessing?.();
    };

    xhr.onload = () => {
      let data: T;
      try {
        data = xhr.responseText ? (JSON.parse(xhr.responseText) as T) : ({} as T);
      } catch {
        if (xhr.status === 413) {
          reject(new Error('Photos are too large. Please use smaller images (under 5MB each) and try again.'));
          return;
        }
        if (xhr.status === 504 || xhr.status === 502 || xhr.status === 524) {
          reject(
            new Error(
              'The server took too long to respond. Please try again with smaller photos, or use a stronger Wi‑Fi connection.'
            )
          );
          return;
        }
        reject(
          new Error(
            'The server returned an unexpected response. Please try again. If it keeps failing, use smaller photos.'
          )
        );
        return;
      }

      resolve({
        ok: xhr.status >= 200 && xhr.status < 300,
        status: xhr.status,
        data,
      });
    };

    xhr.onerror = () =>
      reject(
        new Error(
          'Network error while submitting. Check your internet connection and try again. On mobile data, try Wi‑Fi.'
        )
      );
    xhr.onabort = () => reject(new Error('Upload was cancelled.'));
    xhr.ontimeout = () =>
      reject(
        new Error(
          'Upload timed out. Please use smaller photos (under 2MB each if possible) or switch to a stronger Wi‑Fi connection, then try again.'
        )
      );

    xhr.send(formData);
  });
}
