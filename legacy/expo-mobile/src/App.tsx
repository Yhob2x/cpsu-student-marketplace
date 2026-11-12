import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, FlatList, Image, Pressable, RefreshControl, ScrollView, Text, TextInput, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { api, explain, imageUrl, peso, refresh, signIn, signOut } from './api';
import { useTheme } from './theme';

type Me = { id: number; displayName: string; affiliations: { id: number; campus: { name: string }; status: string }[]; storeId: number | null };
const Auth = createContext<{ me: Me | null; reload: () => Promise<void>; out: () => Promise<void> }>(null!);
const Stack = createNativeStackNavigator(); const Tabs = createBottomTabNavigator();

function Btn({ label, onPress, disabled, kind }: { label: string; onPress: () => void; disabled?: boolean; kind?: 'ghost' }) {
  const t = useTheme();
  return <Pressable accessibilityRole="button" accessibilityLabel={label} disabled={disabled} onPress={onPress}
    style={{ minHeight: 48, borderRadius: 8, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 16, opacity: disabled ? .5 : 1,
      backgroundColor: kind === 'ghost' ? 'transparent' : t.leaf, borderWidth: kind === 'ghost' ? 1 : 0, borderColor: t.leaf }}>
    <Text style={{ color: kind === 'ghost' ? t.leaf : t.onLeaf, fontWeight: '700' }}>{label}</Text></Pressable>;
}
function Field(p: React.ComponentProps<typeof TextInput>) {
  const t = useTheme();
  return <TextInput placeholderTextColor={t.soft} {...p} style={[{ minHeight: 48, borderWidth: 1, borderColor: t.line, borderRadius: 8, paddingHorizontal: 12, color: t.ink, backgroundColor: t.card }, p.style]} />;
}
const Empty = ({ text }: { text: string }) => { const t = useTheme(); return <Text style={{ color: t.soft, padding: 24, textAlign: 'center' }}>{text}</Text>; };
function RetryState({ message, retry }: { message: string; retry: () => void }) {
  const t = useTheme();
  return <View style={{ padding: 20, gap: 10, backgroundColor: t.bg }}>
    <Text accessibilityRole="alert" style={{ color: t.danger, textAlign: 'center' }}>{message}</Text>
    <Btn label="Try again" onPress={retry} />
  </View>;
}

// Category filter chip, shared by Home and Explore so both surfaces look the same.
function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  const t = useTheme();
  return <Pressable onPress={onPress} accessibilityRole="button" accessibilityState={{ selected: active }}
    style={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: 14, borderRadius: 22, borderWidth: 1, borderColor: t.leaf, backgroundColor: active ? t.leaf : 'transparent' }}>
    <Text style={{ color: active ? t.onLeaf : t.leaf, fontWeight: '600' }}>{label}</Text></Pressable>;
}

// Announcement strip plus a search-led masthead, matching the web header. On phones the tab bar still owns
// navigation; the masthead only carries brand identity and the way into search.
function Masthead({ onSearch }: { onSearch: () => void }) {
  const t = useTheme(); const insets = useSafeAreaInsets();
  return <View style={{ backgroundColor: t.card, paddingTop: insets.top, borderBottomWidth: 1, borderBottomColor: t.line }}>
    <View style={{ backgroundColor: t.forest, paddingVertical: 6, paddingHorizontal: 12 }}>
      <Text style={{ color: t.forestInk, fontSize: 11, textAlign: 'center', fontWeight: '600' }}>Verified CPSU students only · Pay and meet on campus</Text></View>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 10 }}>
      <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: t.forest, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: t.mango, fontWeight: '800', fontSize: 15 }}>C</Text></View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: t.ink, fontWeight: '800', fontSize: 15 }}>CPSU <Text style={{ color: t.leaf }}>Student Marketplace</Text></Text>
        <Text style={{ color: t.soft, fontSize: 9, letterSpacing: 1.5, fontWeight: '600' }}>BUY · SELL · OFFER</Text></View>
    </View>
    <Pressable onPress={onSearch} accessibilityRole="button" accessibilityLabel="Search listings"
      style={{ marginHorizontal: 12, marginBottom: 10, minHeight: 44, justifyContent: 'center', paddingHorizontal: 14, borderRadius: 99, borderWidth: 1, borderColor: t.line, backgroundColor: t.bg }}>
      <Text style={{ color: t.soft, fontSize: 13 }}>Search products, services and skills</Text></Pressable>
  </View>;
}

// A product card from the web storefront: photo with the category badge, seller line, campus and the price tag.
// The card grows to fill its row cell; percentage widths are unreliable across React Native targets, so two columns are
// built from explicit row pairs in CardGrid and from `numColumns={2}` in the list screens.
function ListingCard({ l, onPress }: { l: any; onPress: () => void }) {
  const t = useTheme();
  return <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`${l.title}, ${peso(Number(l.price))}`}
    style={{ flex: 1, backgroundColor: t.card, borderRadius: 12, borderWidth: 1, borderColor: t.line, overflow: 'hidden' }}>
    <View style={{ aspectRatio: 4 / 3, backgroundColor: t.mangoSoft }}>
      {l.images?.[0] ? <Image source={{ uri: imageUrl(l.images[0]) }} style={{ flex: 1 }} accessibilityLabel={l.title} />
        : <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: t.soft, fontSize: 11 }}>No photo</Text></View>}
      <Text style={{ position: 'absolute', left: 6, top: 6, backgroundColor: 'rgba(255,255,255,.92)', color: '#0e2815', fontSize: 10, fontWeight: '700', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 99, overflow: 'hidden' }}>{l.type === 'service' ? 'Service' : 'Product'}</Text>
      {l.availability !== 'available' && <Text style={{ position: 'absolute', right: 6, top: 6, backgroundColor: t.forest, color: t.forestInk, fontSize: 10, fontWeight: '700', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 99, overflow: 'hidden' }}>{String(l.availability).replace('_', ' ')}</Text>}
    </View>
    <View style={{ padding: 8, gap: 2 }}>
      <Text numberOfLines={1} style={{ color: t.soft, fontSize: 10, fontWeight: '600' }}>{l.category?.name}{l.condition ? ` · ${String(l.condition).replace('_', ' ')}` : ''}</Text>
      <Text numberOfLines={2} style={{ color: t.ink, fontWeight: '700', fontSize: 14, minHeight: 34 }}>{l.title}</Text>
      <Text numberOfLines={1} style={{ color: t.ink, fontSize: 11, fontWeight: '600' }}>{l.seller.storeName}</Text>
      <Text numberOfLines={1} style={{ color: t.soft, fontSize: 11 }}>{l.campus.name}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
        <Text style={{ color: t.ink, fontWeight: '800', fontSize: 16 }}>{peso(Number(l.price))}</Text>
        <Text style={{ color: t.leaf, fontWeight: '800', fontSize: 15 }}>›</Text></View>
    </View>
  </Pressable>;
}
// Two cards per row, as explicit pairs: `flexWrap` alone relied on a measured width that a scrollbar invalidated, and
// React Native Web ignores percentage maxWidth, so a leftover odd card gets a spacer to keep its column size.
function CardGrid({ rows, nav }: { rows: any[]; nav: any }) {
  const pairs: any[][] = [];
  for (let i = 0; i < rows.length; i += 2) pairs.push(rows.slice(i, i + 2));
  return <View style={{ gap: 10 }}>{pairs.map(pair => <View key={pair[0].id} style={{ flexDirection: 'row', gap: 10 }}>
    {pair.map(l => <ListingCard key={l.id} l={l} onPress={() => nav.navigate('Listing', { id: l.id })} />)}
    {pair.length === 1 && <View style={{ flex: 1 }} />}
  </View>)}</View>;
}
function SectionHead({ title, onAll, allLabel = 'See all' }: { title: string; onAll: () => void; allLabel?: string }) {
  const t = useTheme();
  return <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 18, marginBottom: 8 }}>
    <Text style={{ color: t.ink, fontSize: 17, fontWeight: '800' }}>{title}</Text>
    <Pressable onPress={onAll} accessibilityRole="button" accessibilityLabel={`${allLabel} ${title}`} style={{ paddingVertical: 4 }}>
      <Text style={{ color: t.leaf, fontSize: 12, fontWeight: '700' }}>{allLabel} ›</Text></Pressable></View>;
}
// Same hero as the web: eyebrow, two actions, live listing photos and the "From students" sticker. Photos come from the
// listings already loaded for the rails, so the hero costs no extra request and never shows placeholder stock art.
function Hero({ onSearch, onSell, shots }: { onSearch: () => void; onSell: () => void; shots: any[] }) {
  const t = useTheme();
  return <View style={{ backgroundColor: t.mangoSoft, borderWidth: 1, borderColor: t.line, borderRadius: 16, padding: 16, gap: 8 }}>
    <Text style={{ color: t.leaf, fontSize: 10, fontWeight: '800', letterSpacing: 1.5 }}>THE CPSU STUDENT MARKETPLACE</Text>
    <Text style={{ color: t.ink, fontSize: 25, fontWeight: '800', lineHeight: 31 }}>Great finds.{'\n'}Right on campus.</Text>
    <Text style={{ color: t.soft, fontSize: 13, lineHeight: 19 }}>Discover pre-loved essentials, student-made goods and useful skills from the CPSU community. Connect directly with the students behind every listing.</Text>
    <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
      <Pressable onPress={onSearch} accessibilityRole="button" accessibilityLabel="Explore listings"
        style={{ flex: 1, minHeight: 46, borderRadius: 10, backgroundColor: t.forest, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: '#fff', fontWeight: '700' }}>Explore listings ›</Text></Pressable>
      <Pressable onPress={onSell} accessibilityRole="button" accessibilityLabel="Start selling"
        style={{ flex: 1, minHeight: 46, borderRadius: 10, borderWidth: 1, borderColor: t.ink, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: t.ink, fontWeight: '700' }}>Start selling</Text></Pressable>
    </View>
    {shots.length > 0 && <View style={{ flexDirection: 'row', gap: 6, marginTop: 6 }}>
      {shots.slice(0, 3).map(l => <Image key={l.id} source={{ uri: imageUrl(l.images[0]) }} accessibilityLabel={l.title}
        style={{ flex: 1, aspectRatio: 1, borderRadius: 12, backgroundColor: t.card }} />)}
    </View>}
    <View style={{ backgroundColor: t.forest, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, alignSelf: 'flex-start', marginTop: 2 }}>
      <Text style={{ color: t.mango, fontWeight: '800', fontSize: 12 }}>From students</Text>
      <Text style={{ color: t.forestInk, fontSize: 10 }}>for the CPSU community</Text></View>
    <Text style={{ color: t.soft, fontSize: 11 }}>Verified students only · Campus pickup · No middleman</Text></View>;
}
// Soft collection tile like the web `.cat`: a rounded tile with the icon slot and a one-or-two-line label.
function CatTile({ label, onPress }: { label: string; onPress: () => void }) {
  const t = useTheme();
  return <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`Category ${label}`}
    style={{ width: 88, minHeight: 98, paddingVertical: 12, paddingHorizontal: 6, borderRadius: 12, backgroundColor: t.card, borderWidth: 1, borderColor: t.line, alignItems: 'center', gap: 8 }}>
    <View style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: t.mangoSoft, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: t.leaf, fontWeight: '800', fontSize: 16 }}>{label.slice(0, 1).toUpperCase()}</Text></View>
    <Text numberOfLines={2} style={{ color: t.ink, fontSize: 11, fontWeight: '600', textAlign: 'center' }}>{label}</Text></Pressable>;
}
function Promo({ title, body, cta, tone, onPress }: { title: string; body: string; cta: string; tone: string; onPress: () => void }) {
  const t = useTheme();
  return <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`${title} — ${cta}`}
    style={{ backgroundColor: tone, borderWidth: 1, borderColor: t.line, borderRadius: 14, padding: 14, gap: 4, minHeight: 118, justifyContent: 'space-between' }}>
    <View style={{ gap: 4 }}>
      <Text style={{ color: t.ink, fontWeight: '800', fontSize: 15 }}>{title}</Text>
      <Text style={{ color: t.soft, fontSize: 12, lineHeight: 17 }}>{body}</Text></View>
    <Text style={{ color: t.leaf, fontWeight: '700', fontSize: 12, marginTop: 4 }}>{cta} ›</Text></Pressable>;
}
function Steps() {
  const t = useTheme();
  const items = [
    { t: 'Find something', b: 'Filter by campus, category and price. Listings are reviewed before they appear.' },
    { t: 'Message the seller', b: 'Ask if it is still available and agree the details in Messages.' },
    { t: 'Meet on campus', b: 'Hand over payment and the item directly. The marketplace never holds money.' },
  ];
  return <View style={{ backgroundColor: t.card, borderWidth: 1, borderColor: t.line, borderRadius: 16, padding: 14, gap: 12, marginTop: 20 }}>
    <Text style={{ color: t.ink, fontSize: 17, fontWeight: '800' }}>How it works</Text>
    {items.map((s, i) => <View key={s.t} style={{ flexDirection: 'row', gap: 10 }}>
      <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: t.mango, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: t.onMango, fontWeight: '800', fontSize: 12 }}>{i + 1}</Text></View>
      <View style={{ flex: 1 }}><Text style={{ color: t.ink, fontWeight: '700' }}>{s.t}</Text>
        <Text style={{ color: t.soft, fontSize: 12, lineHeight: 17 }}>{s.b}</Text></View></View>)}
  </View>;
}
// Two link groups, the same split the web footer uses.
function SiteFooter({ nav }: { nav: any }) {
  const t = useTheme();
  const link = (label: string, to: string, params?: any) => <Pressable key={label} onPress={() => nav.navigate(to, params)} accessibilityRole="link" accessibilityLabel={label} style={{ paddingVertical: 4 }}>
    <Text style={{ color: t.forestInk, fontSize: 12 }}>{label}</Text></Pressable>;
  const group = (title: string, links: React.ReactNode[]) => <View key={title} style={{ flex: 1, gap: 1 }}>
    <Text style={{ color: '#fff', fontWeight: '800', fontSize: 12, marginBottom: 2 }}>{title}</Text>{links}</View>;
  return <View style={{ backgroundColor: t.forest, borderRadius: 14, padding: 16, gap: 10, marginTop: 24 }}>
    <Text style={{ color: '#fff', fontWeight: '800', fontSize: 15 }}>CPSU Student Marketplace</Text>
    <Text style={{ color: t.forestInk, fontSize: 12, lineHeight: 18 }}>A student-to-student marketplace for Central Philippines State University. Listings are reviewed by campus reviewers; payment and handoff are arranged directly between students.</Text>
    <View style={{ flexDirection: 'row', gap: 12, marginTop: 2 }}>
      {group('Marketplace', [link('All listings', 'Explore'), link('Products', 'Explore', { type: 'physical_product' }), link('Student services', 'Explore', { type: 'service' })])}
      {group('Your account', [link('Saved listings', 'Saved'), link('Messages', 'Inquiries'), link('Profile', 'Profile')])}
    </View>
    <Text style={{ color: t.forestInk, fontSize: 11 }}>© {new Date().getFullYear()} CPSU Student Marketplace · Student-built MVP</Text></View>;
}

function ListScreen({ path, empty, nav, query }: { path: string; empty: string; nav: any; query?: string }) {
  const t = useTheme();
  const [rows, setRows] = useState<any[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const requestId = useRef(0);
  const load = async () => {
    const request = ++requestId.current;
    setBusy(true);
    try {
      const r = await api(path + (query ? `${path.includes('?') ? '&' : '?'}q=${encodeURIComponent(query)}` : ''));
      if (request === requestId.current) { setRows(r.items ?? r); setErr(''); }
    } catch (e) {
      if (request === requestId.current) setErr(explain(e));
    } finally {
      if (request === requestId.current) setBusy(false);
    }
  };
  useEffect(() => {
    requestId.current++;
    setRows(null); setErr(''); setBusy(false);
    const timer = setTimeout(() => { void load(); }, 250);
    return () => { clearTimeout(timer); requestId.current++; };
  }, [path, query]);
  if (!rows && !err) return <View style={{ flex: 1, backgroundColor: t.bg }}><ActivityIndicator accessibilityLabel="Loading listings" style={{ marginTop: 40 }} /></View>;
  if (!rows && err) return <RetryState message={`Could not load listings. ${err}`} retry={() => { void load(); }} />;
  return <FlatList style={{ backgroundColor: t.bg }} data={rows ?? []} keyExtractor={l => String(l.id)} numColumns={2}
    contentContainerStyle={{ padding: 12, gap: 10 }} columnWrapperStyle={{ gap: 10 }}
    refreshControl={<RefreshControl refreshing={busy} onRefresh={() => { void load(); }} />}
    ListHeaderComponent={err ? <RetryState message={`Could not refresh listings. ${err}`} retry={() => { void load(); }} /> : null}
    ListEmptyComponent={<Empty text={empty} />}
    renderItem={({ item }) => <ListingCard l={item} onPress={() => nav.navigate('Listing', { id: item.id })} />} />;
}

// Home mirrors the web storefront in the same order: hero, category rail, top picks, promo tiles, fresh listings,
// services, how it works, the seller call to action, a trust strip and the footer.
function Home({ navigation }: any) {
  const t = useTheme();
  const [recent, setRecent] = useState<any[] | null>(null);
  const [services, setServices] = useState<any[] | null>(null);
  const [popular, setPopular] = useState<any[] | null>(null);
  const [cats, setCats] = useState<any[]>([]);
  const [err, setErr] = useState('');
  const [secondaryError, setSecondaryError] = useState('');

  // One failed request must not blank the whole page, so each rail loads on its own.
  const load = async () => {
    setErr(''); setSecondaryError('');
    const secondaryFailure = () => setSecondaryError('Some categories or featured listings could not load. Check your connection and retry.');
    try { const a = await api('/listings?pageSize=12'); setRecent(a.items); }
    catch (e) { setErr(explain(e)); setRecent([]); }
    api('/listings?type=service&pageSize=6').then(r => setServices(r.items)).catch(() => { setServices([]); secondaryFailure(); });
    api('/listings/popular').then(r => setPopular(r.items ?? [])).catch(() => { setPopular([]); secondaryFailure(); });
    api('/categories').then(setCats).catch(secondaryFailure);
  };
  useEffect(() => { load(); }, []);

  const open = (to: string, params?: any) => navigation.navigate(to, params);
  const top = popular && popular.length > 0 ? popular : (recent ? recent.slice(0, 4) : null);
  // Each listing appears once per page: the fresh and services rails drop whatever the top rail already showed, and a
  // section with nothing left disappears instead of repeating cards.
  const fresh = recent ? recent.filter(l => !(top ?? []).some(x => x.id === l.id)) : null;
  const shown = new Set([...(top ?? []), ...(fresh ?? [])].map(x => x.id));
  const serviceRows = services ? services.filter(l => !shown.has(l.id)) : null;
  const shots = (recent ?? []).filter(l => l.images?.[0]);
  // The rail's "See all" keeps the rail's own filter, so "Student services" opens services rather than everything.
  const section = (title: string, rows: any[] | null, params?: any) => !rows || rows.length === 0 ? null
    : <View><SectionHead title={title} onAll={() => open('Explore', params)} /><CardGrid rows={rows} nav={navigation} /></View>;

  return <View style={{ flex: 1, backgroundColor: t.bg }}>
    <Masthead onSearch={() => open('Explore')} />
    <ScrollView contentContainerStyle={{ padding: 12, paddingBottom: 28, gap: 12 }}>
      <Hero onSearch={() => open('Explore')} onSell={() => open('Profile')} shots={shots} />
      {!!secondaryError && <RetryState message={secondaryError} retry={() => { void load(); }} />}
      <View>
        <SectionHead title="Explore by category" allLabel="View all" onAll={() => open('Explore')} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={{ gap: 8, paddingRight: 8 }}>
          {cats.slice(0, 8).map(c => <CatTile key={c.id} label={c.name} onPress={() => open('Explore', { categoryId: c.id })} />)}
          <CatTile label="All" onPress={() => open('Explore')} />
        </ScrollView>
      </View>

      {recent === null && !err && <ActivityIndicator style={{ marginTop: 24 }} />}
      {!!err && <RetryState message={`Could not load latest listings. ${err}`} retry={() => { void load(); }} />}
      {section(popular?.length ? 'Popular listings' : 'Browse listings', top)}

      <View style={{ gap: 10, marginTop: 4 }}>
        <Promo title="Student services" body="Design, tutoring, printing and IT help from classmates." cta="Browse services" tone={t.mangoSoft} onPress={() => open('Explore', { type: 'service' })} />
        <Promo title="Pre-loved finds" body="Books, gadgets and dorm essentials passed on by students." cta="Browse products" tone={t.card} onPress={() => open('Explore', { type: 'physical_product' })} />
        <Promo title="Have something to sell?" body="Set up your store and publish your first listing." cta="Start selling" tone={t.mint} onPress={() => open('Profile')} />
      </View>

      {section('Fresh listings', fresh)}
      {section('Student services', serviceRows, { type: 'service' })}

      {recent !== null && recent.length === 0 && !err && <Empty text="No listings yet — check back soon." />}

      <Steps />

      <View style={{ backgroundColor: t.forest, borderRadius: 16, padding: 16, gap: 8 }}>
        <Text style={{ color: t.mango, fontSize: 10, fontWeight: '800', letterSpacing: 1.2 }}>YOUR CAMPUS. YOUR COMMUNITY.</Text>
        <Text style={{ color: '#fff', fontSize: 17, fontWeight: '800' }}>Turn what you no longer need into something useful</Text>
        <Text style={{ color: t.forestInk, fontSize: 12, lineHeight: 17 }}>Students with a verified campus affiliation can open a store and publish listings on the website.</Text>
        <Pressable onPress={() => open('Profile')} accessibilityRole="button" accessibilityLabel="Start selling"
          style={{ backgroundColor: t.mango, borderRadius: 10, minHeight: 44, alignItems: 'center', justifyContent: 'center', marginTop: 4 }}>
          <Text style={{ color: t.onMango, fontWeight: '800' }}>Start selling</Text></Pressable>
      </View>

      <View style={{ backgroundColor: t.card, borderWidth: 1, borderColor: t.line, borderRadius: 14, padding: 12, gap: 8 }}>
        {['Reviewer-approved listings', 'No middleman, no fees', 'Meet at a campus pickup spot', 'Report anything that looks wrong'].map(x =>
          <Text key={x} style={{ color: t.ink, fontSize: 12, fontWeight: '600' }}>✓ {x}</Text>)}
      </View>

      <SiteFooter nav={navigation} />
    </ScrollView>
  </View>;
}

function Explore({ navigation, route }: any) {
  const t = useTheme(); const [q, setQ] = useState('');
  const [cats, setCats] = useState<any[]>([]); const [cat, setCat] = useState<number | null>(route?.params?.categoryId ?? null);
  // Typed entry points (promo tiles, footer, rail "See all") pass a listing type, as Explore does on the web.
  const [type, setType] = useState<string | null>(route?.params?.type ?? null);
  useEffect(() => { api('/categories').then(setCats).catch(() => {}); }, []);
  useEffect(() => { if (route?.params?.categoryId) setCat(route.params.categoryId); if (route?.params?.type) setType(route.params.type); }, [route?.params?.categoryId, route?.params?.type]);
  const filters = [cat ? `categoryId=${cat}` : '', type ? `type=${type}` : ''].filter(Boolean).join('&');
  const path = filters ? `/listings?${filters}` : '/listings';
  return <View style={{ flex: 1, backgroundColor: t.bg }}>
    <View style={{ padding: 12, paddingBottom: 0, gap: 8 }}>
      <Field placeholder="Search listings" value={q} onChangeText={setQ} accessibilityLabel="Search listings" />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={{ gap: 8 }}>
        <Chip label="All" active={cat === null && type === null} onPress={() => { setCat(null); setType(null); }} />
        {type && <Chip label={type === 'service' ? 'Services' : 'Products'} active onPress={() => setType(null)} />}
        {cats.map(c => <Chip key={c.id} label={c.name} active={cat === c.id} onPress={() => setCat(cat === c.id ? null : c.id)} />)}
      </ScrollView>
    </View>
    <ListScreen path={path} query={q} nav={navigation} empty="No listings match yet. Try another search or category." />
  </View>;
}

const Saved = ({ navigation }: any) => <View style={{ flex: 1 }}>
  <ListScreen path="/saved" nav={navigation} empty="Nothing saved yet. Tap Save on a listing to keep it here." />
</View>;

// Only a worded basis ("per item", "per hour") tells the buyer anything. A bare number such as the seeded "1" would
// render as "PHP 150 1", so it is left out rather than shown as noise.
const basisNote = (b?: string) => (b && /[a-z]/i.test(b) ? ` · ${b}` : '');

function Listing({ route, navigation }: any) {
  const t = useTheme(); const { me } = useContext(Auth);
  const [l, setL] = useState<any>(null);
  const [body, setBody] = useState('');
  const [note, setNote] = useState('');
  const [loadError, setLoadError] = useState('');
  const [retryKey, setRetryKey] = useState(0);
  const [busy, setBusy] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [reason, setReason] = useState('');
  useEffect(() => {
    let active = true; setL(null); setLoadError('');
    api(`/listings/${route.params.id}`)
      .then(data => { if (active) setL(data); })
      .catch(e => { if (active) setLoadError(explain(e)); });
    return () => { active = false; };
  }, [route.params.id, retryKey]);
  const act = async (fn: () => Promise<any>, ok: string) => {
    if (busy) return;
    setBusy(true); setNote('');
    try { await fn(); setNote(ok); }
    catch (e) { setNote(explain(e)); }
    finally { setBusy(false); }
  };
  if (!l) return loadError
    ? <RetryState message={`Could not load this listing. ${loadError}`} retry={() => setRetryKey(n => n + 1)} />
    : <ActivityIndicator accessibilityLabel="Loading listing" style={{ marginTop: 40 }} />;
  return <ScrollView style={{ backgroundColor: t.bg }} contentContainerStyle={{ padding: 16, gap: 12 }}>
    <ScrollView horizontal>{l.images.map((s: string) => <Image key={s} source={{ uri: imageUrl(s) }} accessibilityLabel={l.title} style={{ width: 280, height: 240, borderRadius: 10, marginRight: 8 }} />)}</ScrollView>
    <Text style={{ color: t.ink, fontSize: 24, fontWeight: '800' }}>{l.title}</Text>
    <Text style={{ color: t.ink, fontWeight: '800', backgroundColor: t.mango, alignSelf: 'flex-start', paddingHorizontal: 10, borderRadius: 4 }}>{peso(l.price)}{basisNote(l.priceBasis)}</Text>
    <Text style={{ color: t.ink }}>{l.description}</Text>
    {!!l.condition && <Text style={{ color: t.soft }}>Condition: {l.condition.replace('_', ' ')}</Text>}
    <Text style={{ color: t.soft }}>Availability: {l.availability}</Text>
    {l.availability !== 'available' && <Text accessibilityLiveRegion="polite" style={{ color: t.ink }}>This item is {l.availability}. New inquiries are unavailable.</Text>}
    {me?.storeId === l.seller.id && <Text style={{ color: t.soft }}>This is your own listing.</Text>}
    <Text style={{ color: t.soft }}>Sold by {l.seller.storeName} at {l.campus.name}. Payment and handoff are arranged directly with the seller.</Text>
    {me ? <>
      <Field placeholder="Is this still available?" value={body} onChangeText={setBody} multiline maxLength={1000} editable={!busy} style={{ minHeight: 80 }} accessibilityLabel="Message to seller" />
      <Btn label={busy ? 'Please wait…' : 'Send inquiry'} disabled={busy || !body.trim() || l.availability !== 'available' || me?.storeId === l.seller.id}
        onPress={() => { const message = body.trim(); void act(async () => { await api('/inquiries', { listingId: l.id, body: message }); setBody(''); }, 'Message sent. Continue in Messages.'); }} />
      {me?.storeId !== l.seller.id && l.availability === 'available' && <Btn kind="ghost" label="Save" disabled={busy} onPress={() => { void act(() => api(`/saved/${l.id}`, undefined, 'PUT'), 'Saved. Find it under Profile, Saved listings.'); }} />}
      {!reporting ? <Btn kind="ghost" label="Report listing" disabled={busy} onPress={() => { setNote(''); setReporting(true); }} />
        : <View style={{ padding: 12, gap: 10, borderWidth: 1, borderColor: t.line, borderRadius: 10 }}>
          <Text style={{ color: t.ink, fontWeight: '700' }}>Why are you reporting this listing?</Text>
          <Text style={{ color: t.soft }}>Describe the problem in at least 10 characters. A campus reviewer will review your report.</Text>
          <Field multiline value={reason} onChangeText={setReason} maxLength={1000} editable={!busy}
            accessibilityLabel="Reason for reporting this listing" placeholder="Describe the issue…" style={{ minHeight: 96, textAlignVertical: 'top' }} />
          <Text style={{ color: t.soft }}>{reason.length}/1000 characters</Text>
          <Btn label={busy ? 'Sending report…' : 'Send report'} disabled={busy || reason.trim().length < 10}
            onPress={() => { const reportReason = reason.trim(); void act(async () => { await api('/reports', { listingId: l.id, reason: reportReason }); setReporting(false); setReason(''); }, 'Report sent to a campus reviewer.'); }} />
          <Btn kind="ghost" label="Cancel report" disabled={busy} onPress={() => { setReporting(false); setReason(''); }} />
        </View>}
    </> : <Btn label="Sign in to message the seller" onPress={() => navigation.navigate('Auth')} />}
    {!!note && <Text accessibilityLiveRegion="polite" style={{ color: t.ink }}>{note}</Text>}
  </ScrollView>;
}

function Inquiries({ navigation }: any) {
  const t = useTheme(); const { me } = useContext(Auth);
  const [rows, setRows] = useState<any[] | null>(null);
  const [err, setErr] = useState('');
  const [retryKey, setRetryKey] = useState(0);
  useEffect(() => {
    if (!me) { setRows(null); return; }
    let active = true;
    setRows(null); setErr('');
    api<any[]>('/inquiries')
      .then(data => { if (active) { setRows(data); setErr(''); } })
      .catch(e => { if (active) setErr(explain(e)); });
    return () => { active = false; };
  }, [me?.id, retryKey]);
  if (!me) return <Gate nav={navigation} />;
  if (err) return <RetryState message={`Could not load messages. ${err}`} retry={() => setRetryKey(n => n + 1)} />;
  if (rows === null) return <ActivityIndicator accessibilityLabel="Loading conversations" style={{ marginTop: 40 }} />;
  return <FlatList style={{ backgroundColor: t.bg }} data={rows} keyExtractor={r => String(r.id)} contentContainerStyle={{ padding: 12 }}
    ListEmptyComponent={<Empty text="No conversations yet. Open a listing and message the seller." />}
    renderItem={({ item }) => <Pressable accessibilityRole="button" accessibilityLabel={`Open conversation about ${item.listing.title}`}
      onPress={() => navigation.navigate('Thread', { id: item.id })}
      style={{ padding: 12, backgroundColor: t.card, borderRadius: 10, marginBottom: 8, borderWidth: 1, borderColor: t.line }}>
      <Text style={{ color: t.ink, fontWeight: '700' }}>{item.listing.title}</Text><Text style={{ color: t.soft }} numberOfLines={1}>{item.lastMessage?.body}</Text></Pressable>} />;
}
function Thread({ route }: any) {
  const t = useTheme();
  const [d, setD] = useState<any>(null);
  const [body, setBody] = useState('');
  const [err, setErr] = useState('');
  const [sendError, setSendError] = useState('');
  const [sending, setSending] = useState(false);
  const sendingRef = useRef(false);
  const requestId = useRef(0);
  const load = async () => {
    const request = ++requestId.current;
    try {
      const next = await api(`/inquiries/${route.params.id}/messages`);
      if (request === requestId.current) { setD(next); setErr(''); }
    } catch (e) {
      if (request === requestId.current) setErr(explain(e));
    }
  };
  useEffect(() => {
    setD(null); setErr(''); setSendError(''); setBody('');
    void load();
    const timer = setInterval(() => { if (AppState.currentState === 'active') void load(); }, 3000);
    return () => { clearInterval(timer); requestId.current++; };
  }, [route.params.id]);
  const send = async () => {
    const message = body.trim();
    if (!message || sendingRef.current || d?.thread?.status === 'closed') return;
    sendingRef.current = true;
    setSending(true); setSendError('');
    try {
      await api(`/inquiries/${route.params.id}/messages`, { body: message });
      setBody('');
      await load();
    } catch (e) {
      // Preserve the text on failed delivery so it can be retried without retyping.
      setSendError(`Message delivery was not confirmed. ${explain(e)} Your reply is still here; check the conversation before resending.`);
    } finally { sendingRef.current = false; setSending(false); }
  };
  if (!d && err) return <RetryState message={`Could not load this conversation. ${err}`} retry={() => { void load(); }} />;
  if (!d) return <ActivityIndicator accessibilityLabel="Loading conversation" style={{ marginTop: 40 }} />;
  const closed = d.thread?.status === 'closed';
  return <View style={{ flex: 1, backgroundColor: t.bg }}>
    {err ? <RetryState message={`Could not refresh messages. ${err}`} retry={() => { void load(); }} /> : null}
    <FlatList data={d.messages} keyExtractor={m => String(m.id)} contentContainerStyle={{ padding: 12 }}
      renderItem={({ item }) => <View style={{ alignSelf: item.mine ? 'flex-end' : 'flex-start', maxWidth: '80%', padding: 10, borderRadius: 10, marginBottom: 6, backgroundColor: item.mine ? t.mangoSoft : t.card, borderWidth: 1, borderColor: t.line }}>
        <Text style={{ color: t.ink }}>{item.body}</Text></View>} />
    {closed ? <Text accessibilityLiveRegion="polite" style={{ color: t.soft, padding: 12 }}>This conversation is closed. You can still read earlier messages.</Text>
      : <View style={{ padding: 12, gap: 8 }}>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Field style={{ flex: 1 }} value={body} onChangeText={setBody} maxLength={1000} editable={!sending} placeholder="Reply" accessibilityLabel="Reply to this conversation" />
          <Btn label={sending ? 'Sending…' : 'Send'} disabled={sending || !body.trim()} onPress={() => { void send(); }} />
        </View>
        {!!sendError && <Text accessibilityRole="alert" style={{ color: t.danger }}>{sendError}</Text>}
      </View>}
  </View>;
}

function Gate({ nav }: any) { const t = useTheme(); return <View style={{ flex: 1, padding: 24, justifyContent: 'center', gap: 12, backgroundColor: t.bg }}><Text style={{ color: t.ink, fontSize: 20, fontWeight: '800' }}>Sign in to continue</Text><Btn label="Sign in or create account" onPress={() => nav.navigate('Auth')} /></View>; }
function AuthScreen({ navigation }: any) {
  const t = useTheme(); const { reload } = useContext(Auth); const [reg, setReg] = useState(false); const [f, setF] = useState({ email: '', password: '', displayName: '' }); const [campuses, setCampuses] = useState<any[]>([]); const [campusId, setCampusId] = useState<number | null>(null); const [err, setErr] = useState('');
  const [campusError, setCampusError] = useState('');
  const loadCampuses = () => {
    setCampusError('');
    api<any[]>('/campuses').then(setCampuses).catch(e => setCampusError(explain(e)));
  };
  useEffect(() => { loadCampuses(); }, []);
  const go = async () => { try { await signIn(reg ? '/auth/register' : '/auth/login', reg ? { ...f, campusId } : { email: f.email, password: f.password }); await reload(); navigation.goBack(); } catch (e) { setErr(explain(e)); } };
  return <ScrollView style={{ backgroundColor: t.bg }} contentContainerStyle={{ padding: 20, gap: 12 }}>
    <Text style={{ color: t.ink, fontSize: 26, fontWeight: '800' }}>{reg ? 'Create your account' : 'Sign in'}</Text>
    {reg && <Field placeholder="Name shown to others" value={f.displayName} onChangeText={v => setF({ ...f, displayName: v })} />}
    <Field placeholder="Email" autoCapitalize="none" keyboardType="email-address" value={f.email} onChangeText={v => setF({ ...f, email: v })} />
    <Field placeholder={reg ? 'Password (10+ characters)' : 'Password'} secureTextEntry value={f.password} onChangeText={v => setF({ ...f, password: v })} />
    {reg && !!campusError && <RetryState message={`Could not load campuses. ${campusError}`} retry={loadCampuses} />}
    {reg && campuses.map(c => <Btn key={c.id} kind={campusId === c.id ? undefined : 'ghost'} label={c.name} onPress={() => setCampusId(c.id)} />)}
    {!!err && <Text style={{ color: t.danger }} accessibilityLiveRegion="assertive">{err}</Text>}
    <Btn label={reg ? 'Create account' : 'Sign in'} disabled={reg && !campusId} onPress={go} />
    <Btn kind="ghost" label={reg ? 'I already have an account' : 'Create an account'} onPress={() => setReg(!reg)} /></ScrollView>;
}

// Same wording as the web notification centre, so one event reads identically on both clients.
function notifText(n: any): string {
  const p = n.payload ?? {};
  switch (n.type) {
    case 'inquiry.new': return `New inquiry about ${p.listingTitle ?? 'your listing'}.`;
    case 'inquiry.reply': return `New reply about ${p.listingTitle ?? 'your listing'}.`;
    case 'affiliation.decision': return p.decision === 'verified' ? 'Your CPSU affiliation was verified.' : `Your affiliation was rejected${p.reason ? `: ${p.reason}` : '.'}`;
    case 'listing.decision': return `${p.title ? `"${p.title}" ` : 'Your listing '}${({ approved: 'was approved', changes_requested: 'needs changes', rejected: 'was rejected' } as any)[p.decision] ?? 'was reviewed'}.${p.reason ? ` Reason: ${p.reason}` : ''}`;
    case 'listing.suspended': return `A listing of yours was suspended.${p.reason ? ` Reason: ${p.reason}` : ''}`;
    default: return 'Marketplace update.';
  }
}

function Profile({ navigation }: any) {
  const t = useTheme(); const { me, out } = useContext(Auth);
  const [mine, setMine] = useState<any[]>([]);
  const [notifs, setNotifs] = useState<any[]>([]);
  const [mineLoading, setMineLoading] = useState(false);
  const [notifsLoading, setNotifsLoading] = useState(false);
  const [mineError, setMineError] = useState('');
  const [notifsError, setNotifsError] = useState('');
  const [markingRead, setMarkingRead] = useState(false);
  const heading = { color: t.ink, fontSize: 18, fontWeight: '700' as const, marginTop: 16, marginBottom: 4 };
  const loadNotifs = async () => {
    setNotifsLoading(true); setNotifsError('');
    try { setNotifs(await api('/notifications')); }
    catch (e) { setNotifsError(explain(e)); }
    finally { setNotifsLoading(false); }
  };
  const loadMine = async () => {
    setMineLoading(true); setMineError('');
    try { setMine(await api('/seller/listings')); }
    catch (e) { setMineError(explain(e)); }
    finally { setMineLoading(false); }
  };
  useEffect(() => {
    if (me) void loadNotifs();
    if (me?.storeId) void loadMine();
  }, [me?.id, me?.storeId]);
  if (!me) return <Gate nav={navigation} />;
  const unread = notifs.filter(n => !n.readAt).length;
  const markAll = async () => {
    if (markingRead) return;
    setMarkingRead(true);
    try { await api('/notifications/read', {}); await loadNotifs(); }
    catch (e) { setNotifsError(`Could not mark notifications as read. ${explain(e)}`); }
    finally { setMarkingRead(false); }
  };
  return <ScrollView style={{ backgroundColor: t.bg }} contentContainerStyle={{ padding: 16, gap: 10 }}>
    <Text style={{ color: t.ink, fontSize: 22, fontWeight: '800' }}>{me.displayName}</Text>
    {me.affiliations.map(a => <Text key={a.id} style={{ color: t.soft }}>{a.campus.name}: {a.status}</Text>)}

    <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }}><Text style={heading}>Notifications</Text>
      {unread > 0 && <Pressable disabled={markingRead} onPress={() => { void markAll(); }} accessibilityRole="button" accessibilityLabel={`Mark ${unread} notifications as read`}>
        <Text style={{ color: t.leaf, fontWeight: '700' }}>{markingRead ? 'Marking…' : `Mark all read (${unread})`}</Text></Pressable>}</View>
    {notifsLoading && <Text accessibilityLiveRegion="polite" style={{ color: t.soft }}>Loading notifications…</Text>}
    {!!notifsError && <RetryState message={`Notifications could not load. ${notifsError}`} retry={() => { void loadNotifs(); }} />}
    {!notifsLoading && !notifsError && notifs.length === 0 && <Text style={{ color: t.soft }}>Nothing yet. Listing decisions and inquiry replies appear here.</Text>}
    {notifs.slice(0, 6).map(n => <View key={n.id} style={{ padding: 10, backgroundColor: t.card, borderRadius: 8, borderWidth: 1, borderColor: n.readAt ? t.line : t.leaf }}>
      <Text style={{ color: t.ink }}>{notifText(n)}</Text>
      <Text style={{ color: t.soft, fontSize: 12 }}>{new Date(n.createdAt).toLocaleDateString()}{n.readAt ? '' : ', unread'}</Text></View>)}

    <Text style={heading}>My listings</Text>
    {!me.storeId && <Text style={{ color: t.soft }}>Open a store on the website once a campus reviewer verifies your affiliation.</Text>}
    {mineLoading && <Text accessibilityLiveRegion="polite" style={{ color: t.soft }}>Loading your listings…</Text>}
    {!!mineError && <RetryState message={`Your listings could not load. ${mineError}`} retry={() => { void loadMine(); }} />}
    {mine.map(l => <View key={l.id} style={{ padding: 10, backgroundColor: t.card, borderRadius: 8, borderWidth: 1, borderColor: t.line }}>
      <Text style={{ color: t.ink, fontWeight: '600' }}>{l.title}</Text><Text style={{ color: t.soft }}>{l.status.replace('_', ' ')}, {peso(Number(l.price))}</Text></View>)}

    <View style={{ gap: 8, marginTop: 8 }}>
      <Btn kind="ghost" label="Saved listings" onPress={() => navigation.navigate('Saved')} />
      <Btn kind="ghost" label="Sign out" onPress={out} />
    </View>
    <Text style={{ color: t.soft, fontSize: 12 }}>Publishing listings and replying with photos happens on the website in this version.</Text>
  </ScrollView>;
}

function Main() {
  const t = useTheme();
  // tabBarIcon returns null on purpose: without it React Navigation renders a placeholder glyph on web, which showed up
  // as duplicated "⏷" characters before every label.
  return <Tabs.Navigator screenOptions={{ tabBarActiveTintColor: t.leaf, tabBarIcon: () => null, tabBarStyle: { backgroundColor: t.card }, headerStyle: { backgroundColor: t.card }, headerTitleStyle: { color: t.ink } }}>
    <Tabs.Screen name="Home" component={Home} options={{ headerShown: false }} />
    <Tabs.Screen name="Explore" component={Explore} />
    <Tabs.Screen name="Inquiries" component={Inquiries} options={{ tabBarLabel: 'Messages', title: 'Messages' }} />
    <Tabs.Screen name="Profile" component={Profile} />
  </Tabs.Navigator>;
}

export default function App() {
  const [me, setMe] = useState<Me | null>(null);
  const reload = async () => { try { setMe(await api('/me')); } catch { setMe(null); } };
  const out = async () => { await signOut(); setMe(null); };
  useEffect(() => { refresh().then(async ok => { if (ok) await reload(); }); }, []);
  return <SafeAreaProvider><Auth.Provider value={{ me, reload, out }}><NavigationContainer>
    <Stack.Navigator><Stack.Screen name="Main" component={Main} options={{ headerShown: false }} />
      <Stack.Screen name="Listing" component={Listing} /><Stack.Screen name="Thread" component={Thread} options={{ title: 'Conversation' }} />
      <Stack.Screen name="Saved" component={Saved} options={{ title: 'Saved listings' }} />
      <Stack.Screen name="Auth" component={AuthScreen} options={{ title: 'Account', presentation: 'modal' }} /></Stack.Navigator>
  </NavigationContainer><StatusBar style="auto" /></Auth.Provider></SafeAreaProvider>;
}
