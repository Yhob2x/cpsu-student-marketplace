import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { useState } from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SelectedPhotoPreviews } from '../../src/selected-photo-previews';
import { MAX_LISTING_PHOTOS, selectedPhotosError } from '../../src/listing-photo-uploads';

function PhotoPicker() {
  const [files, setFiles] = useState<File[]>([]);
  const [cover, setCover] = useState(0);
  const error = selectedPhotosError(files);
  return <div>
    <label htmlFor="photo-picker">Listing photos</label>
    <input id="photo-picker" type="file" accept="image/png,image/jpeg,image/webp" multiple
      onChange={event => { setFiles(Array.from(event.target.files ?? [])); setCover(0); }} />
    <p role="status">{files.length} of {MAX_LISTING_PHOTOS} photos selected</p>
    {error && <p role="alert">{error}</p>}
    {!error && <SelectedPhotoPreviews files={files} coverIndex={cover} onCoverChange={setCover} />}
  </div>;
}

const oldCreate = Object.getOwnPropertyDescriptor(URL, 'createObjectURL');
const oldRevoke = Object.getOwnPropertyDescriptor(URL, 'revokeObjectURL');
let nextBlob = 0;
beforeEach(() => {
  nextBlob = 0;
  Object.defineProperty(URL, 'createObjectURL', {
    configurable: true, value: () => 'blob:cpsu-photo-test-' + (++nextBlob),
  });
  Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: () => {} });
});
afterEach(() => {
  cleanup();
  if (oldCreate) Object.defineProperty(URL, 'createObjectURL', oldCreate);
  else delete (URL as any).createObjectURL;
  if (oldRevoke) Object.defineProperty(URL, 'revokeObjectURL', oldRevoke);
  else delete (URL as any).revokeObjectURL;
});
const photos = (count: number) => Array.from({ length: count }, (_, i) =>
  new File(['synthetic'], 'campus-photo-' + (i + 1) + '.png', { type: 'image/png' }));

describe('Phase 2: photo picker behavior and cover selection', () => {
  test('selection previews actual filenames and lets the student choose a cover', async () => {
    const user = userEvent.setup();
    render(<PhotoPicker />);
    await user.upload(screen.getByLabelText('Listing photos'), photos(3));
    expect(screen.getByRole('status').textContent).toContain('3 of 5 photos selected');
    expect(screen.getAllByRole('img')).toHaveLength(3);
    expect(screen.getByRole('button', { name: 'Cover photo' }).getAttribute('aria-pressed')).toBe('true');
    await user.click(screen.getAllByRole('button', { name: 'Make cover' })[1]);
    expect(screen.getAllByRole('button', { name: 'Cover photo' })).toHaveLength(1);
    const chosen = screen.getAllByText('campus-photo-3.png');
    expect(chosen.length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'Cover photo' }).closest('.selected-photo-preview')?.textContent)
      .toContain('campus-photo-3.png');
  });

  test('six images trigger the five-photo limit without showing a publishable preview', async () => {
    const user = userEvent.setup();
    render(<PhotoPicker />);
    await user.upload(screen.getByLabelText('Listing photos'), photos(6));
    expect(screen.getByRole('alert').textContent).toContain('no more than 5 additional photos');
    expect(screen.queryByRole('group', { name: 'Selected photo previews' })).toBeNull();
  });
});
