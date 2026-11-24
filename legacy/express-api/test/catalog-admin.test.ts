import { describe, expect, it } from 'bun:test';
import express from 'express';
import request from 'supertest';
import { campusInput, campusPatch, categoryInput, catalogAdminRoutes, serviceInput } from '../src/routes/catalog-admin.js';
import { errorHandler } from '../src/http.js';
import { canManageCatalog, type AuthUser } from '../src/permissions.js';

const user = (roles: AuthUser['roles']): AuthUser => ({ id: 5, displayName: 'Staff', email: 'staff@test.local', roles });

const appFor = (account?: AuthUser) => {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => { req.user = account; next(); });
  app.use('/admin/catalog', catalogAdminRoutes);
  app.use(errorHandler);
  return app;
};

describe('campus and service catalog boundaries', () => {
  it('allows only a university-wide admin, not a campus reviewer or scoped university admin', () => {
    expect(canManageCatalog(user([{ role: 'university_admin', campusId: null }]))).toBe(true);
    expect(canManageCatalog(user([{ role: 'university_admin', campusId: 1 }]))).toBe(false);
    expect(canManageCatalog(user([{ role: 'campus_reviewer', campusId: 1 }]))).toBe(false);
    expect(canManageCatalog(user([{ role: 'system_admin', campusId: null }]))).toBe(false);
    expect(canManageCatalog(user([]))).toBe(false);
  });
  it('requires authentication and rejects unauthorized writes before contacting the DB', async () => {
    const anonymous = appFor();
    expect((await request(anonymous).get('/admin/catalog')).status).toBe(401);
    expect((await request(anonymous).post('/admin/catalog/services').send({ name: 'Tutoring' })).status).toBe(401);
    const reviewer = appFor(user([{ role: 'campus_reviewer', campusId: 1 }]));
    expect((await request(reviewer).get('/admin/catalog')).status).toBe(403);
    expect((await request(reviewer).patch('/admin/catalog/campuses/1').send({ name: 'New campus name' })).status).toBe(403);
    expect((await request(reviewer).post('/admin/catalog/services').send({ name: 'Tutoring' })).status).toBe(403);
    expect((await request(reviewer).post('/admin/catalog/categories').send({ name: 'Textbooks', listingType: 'physical_product' })).status).toBe(403);
    expect((await request(reviewer).patch('/admin/catalog/categories/1').send({ name: 'New product name' })).status).toBe(403);
  });
  it('rejects invalid product/service category requests before writing to the database', async () => {
    const admin = appFor(user([{ role: 'university_admin', campusId: null }]));
    expect((await request(admin).post('/admin/catalog/categories')
      .send({ name: 'Books', listingType: 'food' })).status).toBe(400);
    expect((await request(admin).post('/admin/catalog/categories')
      .send({ name: 'Books', listingType: 'physical_product', policyRiskLevel: 0 })).status).toBe(400);
    expect((await request(admin).patch('/admin/catalog/categories/17')
      .send({ name: 'Tutoring', listingType: 'physical_product' })).status).toBe(400);
    expect((await request(admin).patch('/admin/catalog/categories/not-a-number')
      .send({ name: 'Tutoring' })).status).toBe(400);
  });
  it('validates campus codes, names and unexpected fields', () => {
    expect(campusInput.parse({ code: ' main_1 ', name: ' Main Campus ' }))
      .toEqual({ code: 'MAIN_1', name: 'Main Campus' });
    expect(campusInput.safeParse({ code: 'bad code', name: 'A campus' }).success).toBe(false);
    expect(campusPatch.safeParse({ confirmImpact: true }).success).toBe(false);
    expect(campusPatch.safeParse({ active: false, confirmImpact: true }).success).toBe(true);
    expect(campusPatch.safeParse({ name: 'Main campus', deletedAt: null }).success).toBe(false);
  });
  it('keeps service operations limited to category names', () => {
    expect(serviceInput.parse({ name: '  Photography  ' })).toEqual({ name: 'Photography' });
    expect(serviceInput.safeParse({ name: ' ' }).success).toBe(false);
    expect(serviceInput.safeParse({ name: 'Design', listingType: 'physical_product' }).success).toBe(false);
    expect(serviceInput.safeParse({ name: 'Design', policyRiskLevel: 0 }).success).toBe(false);
    expect(categoryInput.parse({ listingType: 'physical_product', name: '  Textbooks ' }))
      .toEqual({ listingType: 'physical_product', name: 'Textbooks' });
    expect(categoryInput.parse({ listingType: 'service', name: '  Tutoring ' }))
      .toEqual({ listingType: 'service', name: 'Tutoring' });
    expect(categoryInput.safeParse({ name: 'Tutoring', listingType: 'wrong' }).success).toBe(false);
    expect(categoryInput.safeParse({ name: 'Textbooks' }).success).toBe(false);
    expect(categoryInput.safeParse({ name: 'Textbooks', listingType: 'physical_product', policyRiskLevel: 2 }).success).toBe(false);
  });
});
