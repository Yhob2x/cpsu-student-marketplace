import { describe, it, expect } from 'bun:test';
import { canReview, reviewCampusIds, isMaterialChange } from '../src/permissions.js';

const user = (roles: { role: string; campusId: number | null }[]) => ({ id: 1, email: 'a@b.c', displayName: 'A', roles });

describe('review authority', () => {
  it('limits a campus reviewer to their own campus', () => {
    const u = user([{ role: 'campus_reviewer', campusId: 2 }]);
    expect(canReview(u, 2)).toBe(true);
    expect(canReview(u, 3)).toBe(false);
    expect(reviewCampusIds(u)).toEqual([2]);
  });
  it('lets a global university admin review any campus', () => {
    const u = user([{ role: 'university_admin', campusId: null }]);
    expect(canReview(u, 99)).toBe(true);
    expect(reviewCampusIds(u)).toBe('all');
  });
  it('does not let a system administrator approve listings', () => {
    const u = user([{ role: 'system_admin', campusId: null }]);
    expect(canReview(u, 1)).toBe(false);
    expect(reviewCampusIds(u)).toEqual([]);
  });
  it('gives plain students no review scope', () => {
    expect(reviewCampusIds(user([]))).toEqual([]);
  });
});

describe('material changes', () => {
  it('flags title/description/category edits but not price or availability', () => {
    expect(isMaterialChange({ title: 'x' })).toBe(true);
    expect(isMaterialChange({ categoryId: 3 })).toBe(true);
    expect(isMaterialChange({ price: 10, availability: 'sold out' })).toBe(false);
  });
});
