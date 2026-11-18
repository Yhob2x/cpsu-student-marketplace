/**
 * SELECT-only local smoke for managed content after activation.
 * Calls real Express routes in process; does not open a port, create users,
 * write records, apply migrations or change publication state.
 */
import express from 'express';
import request from 'supertest';
import adminRoutes from '../src/routes/admin.js';
import publicRoutes from '../src/routes/public.js';
import homeRoutes from '../src/routes/home-page-public.js';
import { errorHandler } from '../src/http.js';
import { prisma } from '../src/db.js';

const dbUrl = new URL(process.env.DATABASE_URL || '');
if (dbUrl.hostname !== '127.0.0.1' ||
    decodeURIComponent(dbUrl.pathname.slice(1)) !== 'cpsu_marketplace' ||
    process.env.NODE_ENV === 'production')
  throw new Error('Only the local CPSU development database may be checked');
const app = express();
app.use((req, _res, next) => {
  req.user = { id: -1, email: 'synthetic@example.invalid', displayName: 'Synthetic',
    roles: [{role:'university_admin', campusId:null}] };
  next();
});
app.use('/api/v1/admin',adminRoutes);
app.use('/api/v1/home-page',homeRoutes);
app.use('/api/v1',publicRoutes);
app.use(errorHandler);
try {
  for (const [url, isAdmin] of [
    ['/api/v1/admin/content/guidelines', true],
    ['/api/v1/admin/content/announcements', true],
    ['/api/v1/guidelines', false],
    ['/api/v1/announcements', false],
    ['/api/v1/home-page', false],
  ] as const) {
    const res = await request(app).get(url);
    if (res.status !== 200) throw new Error(url + ' returned ' + res.status);
    console.log(JSON.stringify({endpoint:url,status:res.status,
      ...(url.endsWith('announcements') ? {itemCount:res.body.items?.length} : {}),
      ...(url.endsWith('guidelines') ? {hasDraftOrPublicContent:Boolean(res.body.draftBody ?? res.body.body)} : {}),
      ...(url.endsWith('home-page') ? {hasCopy:Boolean(res.body.copy)} : {}),
    }));
  }
  const row = await prisma.homePageContent.findUnique({where:{id:1}});
  console.log(JSON.stringify({homepageRecordPreserved:!!row,revision:row?.revision??null,
    publishedRevision:row?.publishedRevision??null}));
} finally { await prisma.$disconnect(); }
