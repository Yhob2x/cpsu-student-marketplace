import { useEffect, useState } from 'react';

type Preview = { file: File; url: string };

export function SelectedPhotoPreviews({ files, coverIndex, onCoverChange, disabled = false }: {
  files: readonly File[];
  coverIndex?: number;
  onCoverChange?: (index: number) => void;
  disabled?: boolean;
}) {
  const [previews, setPreviews] = useState<Preview[]>([]);
  const [failed, setFailed] = useState<string[]>([]);

  useEffect(() => {
    const next = files.map(file => ({ file, url: URL.createObjectURL(file) }));
    setPreviews(next);
    setFailed([]);
    return () => next.forEach(preview => URL.revokeObjectURL(preview.url));
  }, [files]);

  if (!files.length) return null;

  return <div className="selected-photo-previews" role="group" aria-label="Selected photo previews">
    {previews.map(({ file, url }, index) => <div className="selected-photo-preview" key={url}>
      <div className="selected-photo-preview-image">
        {failed.includes(url) ? <span>Preview unavailable</span>
          : <img src={url} alt={`Selected photo ${index + 1}: ${file.name}`} onError={() => setFailed(previous => [...previous, url])} />}
      </div>
      {onCoverChange ? <button type="button" className="selected-photo-cover" aria-pressed={coverIndex === index}
        disabled={disabled} onClick={() => onCoverChange(index)}>
        {coverIndex === index ? 'Cover photo' : 'Make cover'}
      </button> : <span className="selected-photo-position">New photo {index + 1}</span>}
      <small title={file.name}>{file.name}</small>
    </div>)}
  </div>;
}

export function ExistingPhotoChoices({ media, coverMediaId, onCoverChange, disabled = false }: {
  media: readonly { id: number; position: number }[];
  coverMediaId: number | null;
  onCoverChange: (id: number) => void;
  disabled?: boolean;
}) {
  const [failed, setFailed] = useState<number[]>([]);
  const sorted = media.slice().sort((a, b) => a.position - b.position || a.id - b.id);
  if (!sorted.length) return null;
  return <div className="selected-photo-previews" role="group" aria-label="Current listing photos">
    {sorted.map((photo, index) => <div className="selected-photo-preview" key={photo.id}>
      <div className="selected-photo-preview-image">
        {failed.includes(photo.id) ? <span>Photo unavailable</span>
          : <img src={`/api/v1/media/${photo.id}`} alt={`Current listing photo ${index + 1}`}
              loading="lazy" onError={() => setFailed(previous => [...previous, photo.id])} />}
      </div>
      <button type="button" className="selected-photo-cover" aria-pressed={coverMediaId === photo.id}
        disabled={disabled} onClick={() => onCoverChange(photo.id)}>
        {coverMediaId === photo.id ? 'Cover photo' : 'Make cover'}
      </button>
      <small>Current photo {index + 1}</small>
    </div>)}
  </div>;
}
