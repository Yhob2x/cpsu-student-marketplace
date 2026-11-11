import React, { createContext, useContext, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Image, Pressable, RefreshControl, ScrollView, Text, TextInput, View } from 'react-native';
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
        <Text style={{ color: t.mint, fontWeight: '800', fontSize: 15 }}>C</Text></View>
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
      {!!l.category?.name && <Text style={{ position: 'absolute', left: 6, top: 6, backgroundColor: 'rgba(255,255,255,.92)', color: '#0e2815', fontSize: 10, fontWeight: '700', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 99, overflow: 'hidden' }}>{l.category.name}</Text>}
      {l.availability !== 'available' && <Text style={{ position: 'absolute', right: 6, top: 6, backgroundColor: t.forest, color: t.forestInk, fontSize: 10, fontWeight: '700', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 99, overflow: 'hidden' }}>{String(l.availability).replace('_', ' ')}</Text>}
    </View>
    <View style={{ padding: 8, gap: 2 }}>
      <Text numberOfLines={2} style={{ color: t.ink, fontWeight: '700', fontSize: 14, minHeight: 34 }}>{l.title}</Text>
      <Text numberOfLines={1} style={{ color: t.ink, fontSize: 11, fontWeight: '600' }}>{l.seller.storeName}</Text>
      <Text numberOfLines={1} style={{ color: t.soft, fontSize: 11 }}>{l.campus.name}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
        <Text style={{ color: t.onMango, backgroundColor: t.mango, fontWeight: '800', fontSize: 12, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 4, overflow: 'hidden' }}>{peso(Number(l.price))}</Text>
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
function SectionHead({ title, onAll }: { title: string; onAll: () => void }) {
  const t = useTheme();
  return <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 18, marginBottom: 8 }}>
    <Text style={{ color: t.ink, fontSize: 17, fontWeight: '800' }}>{title}</Text>
    <Pressable onPress={onAll} accessibilityRole="button" accessibilityLabel={`See all ${title}`} style={{ paddingVertical: 4 }}>
      <Text style={{ color: t.leaf, fontSize: 12, fontWeight: '700' }}>See all ›</Text></Pressable></View>;
}
function Hero({ onSearch }: { onSearch: () => void }) {
  const t = useTheme();
  return <View style={{ backgroundColor: t.mangoSoft, borderWidth: 1, borderColor: t.line, borderRadius: 16, padding: 16, gap: 8 }}>
    <Text style={{ color: t.leaf, fontSize: 10, fontWeight: '800', letterSpacing: 1.5 }}>CENTRAL PHILIPPINES STATE UNIVERSITY</Text>
    <Text style={{ color: t.ink, fontSize: 25, fontWeight: '800', lineHeight: 31 }}>Buy, sell and offer at CPSU.</Text>
    <Text style={{ color: t.soft, fontSize: 13, lineHeight: 19 }}>Pre-loved items, student-made goods and skills for hire. Message the seller, then agree payment and pickup on campus.</Text>
    <Pressable onPress={onSearch} accessibilityRole="button" accessibilityLabel="Browse listings"
      style={{ minHeight: 46, borderRadius: 10, backgroundColor: t.leaf, alignItems: 'center', justifyContent: 'center', marginTop: 4 }}>
      <Text style={{ color: t.onLeaf, fontWeight: '700' }}>Browse listings</Text></Pressable>
    <Text style={{ color: t.soft, fontSize: 11 }}>Verified students only · Campus pickup · No middleman</Text></View>;
}
function CatTile({ label, onPress }: { label: string; onPress: () => void }) {
  const t = useTheme();
  return <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`Category ${label}`} style={{ width: 76, alignItems: 'center', gap: 6 }}>
    <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: t.mangoSoft, borderWidth: 1, borderColor: t.line, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: t.leaf, fontWeight: '800', fontSize: 18 }}>{label.slice(0, 1).toUpperCase()}</Text></View>
    <Text numberOfLines={2} style={{ color: t.ink, fontSize: 11, fontWeight: '600', textAlign: 'center' }}>{label}</Text></Pressable>;
}
function Promo({ title, body, tone, onPress }: { title: string; body: string; tone: string; onPress: () => void }) {
  const t = useTheme();
  return <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={title}
    style={{ backgroundColor: tone, borderWidth: 1, borderColor: t.line, borderRadius: 14, padding: 14, gap: 4 }}>
    <Text style={{ color: t.ink, fontWeight: '800', fontSize: 15 }}>{title}</Text>
    <Text style={{ color: t.soft, fontSize: 12, lineHeight: 17 }}>{body}</Text>
    <Text style={{ color: t.leaf, fontWeight: '700', fontSize: 12, marginTop: 2 }}>Browse ›</Text></Pressable>;
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
function SiteFooter({ nav }: { nav: any }) {
  const t = useTheme();
  const link = (label: string, to: string) => <Pressable key={label} onPress={() => nav.navigate(to)} accessibilityRole="link" accessibilityLabel={label} style={{ paddingVertical: 6 }}>
    <Text style={{ color: t.forestInk, fontSize: 13 }}>{label}</Text></Pressable>;
  return <View style={{ backgroundColor: t.forest, borderRadius: 14, padding: 16, gap: 8, marginTop: 24 }}>
    <Text style={{ color: '#fff', fontWeight: '800', fontSize: 15 }}>CPSU Student Marketplace</Text>
    <Text style={{ color: t.forestInk, fontSize: 12, lineHeight: 18 }}>A student-to-student marketplace for Central Philippines State University. Listings are reviewed by campus reviewers; payment and handoff are arranged directly between students.</Text>
    <View style={{ marginTop: 4 }}>
      {link('All listings', 'Explore')}{link('Saved listings', 'Saved')}{link('Messages', 'Inquiries')}{link('Profile', 'Profile')}</View>
    <Text style={{ color: t.soft, fontSize: 11 }}>Central Philippines State University · Student-built MVP</Text></View>;
}

function ListScreen({ path, empty, nav, query }: { path: string; empty: string; nav: any; query?: string }) {
  const t = useTheme(); const [rows, setRows] = useState<any[] | null>(null); const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  const load = async () => { setBusy(true); try { const r = await api(path + (query ? `${path.includes('?') ? '&' : '?'}q=${encodeURIComponent(query)}` : '')); setRows(r.items ?? r); setErr(''); } catch (e) { setErr(explain(e)); } setBusy(false); };
  useEffect(() => { const id = setTimeout(load, 250); return () => clearTimeout(id); }, [path, query]);
  if (!rows && !err) return <ActivityIndicator style={{ marginTop: 40 }} />;
  return <FlatList style={{ backgroundColor: t.bg }} data={rows ?? []} keyExtractor={l => String(l.id)} numColumns={2}
    contentContainerStyle={{ padding: 12, gap: 10 }} columnWrapperStyle={{ gap: 10 }}
    refreshControl={<RefreshControl refreshing={busy} onRefresh={load} />}
    ListEmptyComponent={<Empty text={err || empty} />}
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

  // One failed request must not blank the whole page, so each rail loads on its own.
  const load = async () => {
    setErr('');
    try { const a = await api('/listings?pageSize=12'); setRecent(a.items); } catch (e) { setErr(explain(e)); setRecent([]); }
    api('/listings?type=service&pageSize=6').then(r => setServices(r.items)).catch(() => setServices([]));
    api('/listings/popular').then(r => setPopular(r.items ?? [])).catch(() => setPopular([]));
    api('/categories').then(setCats).catch(() => {});
  };
  useEffect(() => { load(); }, []);

  const open = (to: string, params?: any) => navigation.navigate(to, params);
  const top = popular && popular.length > 0 ? popular : (recent ? recent.slice(0, 4) : null);
  // Each listing appears once per page: the fresh and services rails drop whatever the top rail already showed, and a
  // section with nothing left disappears instead of repeating cards.
  const fresh = recent ? recent.filter(l => !(top ?? []).some(x => x.id === l.id)) : null;
  const shown = new Set([...(top ?? []), ...(fresh ?? [])].map(x => x.id));
  const serviceRows = services ? services.filter(l => !shown.has(l.id)) : null;
  const section = (title: string, rows: any[] | null) => !rows || rows.length === 0 ? null
    : <View><SectionHead title={title} onAll={() => open('Explore')} /><CardGrid rows={rows} nav={navigation} /></View>;

  return <View style={{ flex: 1, backgroundColor: t.bg }}>
    <Masthead onSearch={() => open('Explore')} />
    <ScrollView contentContainerStyle={{ padding: 12, paddingBottom: 28, gap: 12 }}>
      <Hero onSearch={() => open('Explore')} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={{ gap: 6, paddingRight: 8 }}>
        {cats.slice(0, 8).map(c => <CatTile key={c.id} label={c.name} onPress={() => open('Explore', { categoryId: c.id })} />)}
        <CatTile label="All" onPress={() => open('Explore')} />
      </ScrollView>

      {recent === null && !err && <ActivityIndicator style={{ marginTop: 24 }} />}
      {!!err && <Empty text={err} />}
      {section(popular?.length ? 'Popular listings' : 'Browse listings', top)}

      <View style={{ gap: 10, marginTop: 4 }}>
        <Promo title="Student services" body="Design, tutoring, printing and IT help from classmates." tone={t.mangoSoft} onPress={() => open('Explore')} />
        <Promo title="Pre-loved finds" body="Books, gadgets and dorm essentials passed on by students." tone={t.card} onPress={() => open('Explore')} />
        <Promo title="Have something to sell?" body="Set up your store on the website and publish your first listing." tone={t.mint} onPress={() => open('Profile')} />
      </View>

      {section('Fresh listings', fresh)}
      {section('Student services', serviceRows)}

      {recent !== null && recent.length === 0 && !err && <Empty text="No listings yet — check back soon." />}

      <Steps />

      <View style={{ backgroundColor: t.forest, borderRadius: 16, padding: 16, gap: 8 }}>
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
  useEffect(() => { api('/categories').then(setCats).catch(() => {}); }, []);
  useEffect(() => { if (route?.params?.categoryId) setCat(route.params.categoryId); }, [route?.params?.categoryId]);
  return <View style={{ flex: 1, backgroundColor: t.bg }}>
    <View style={{ padding: 12, paddingBottom: 0, gap: 8 }}>
      <Field placeholder="Search listings" value={q} onChangeText={setQ} accessibilityLabel="Search listings" />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={{ gap: 8 }}>
        <Chip label="All" active={cat === null} onPress={() => setCat(null)} />
        {cats.map(c => <Chip key={c.id} label={c.name} active={cat === c.id} onPress={() => setCat(cat === c.id ? null : c.id)} />)}
      </ScrollView>
    </View>
    <ListScreen path={cat ? `/listings?categoryId=${cat}` : '/listings'} query={q} nav={navigation} empty="No listings match yet. Try another search or category." />
  </View>;
}

const Saved = ({ navigation }: any) => <View style={{ flex: 1 }}>
  <ListScreen path="/saved" nav={navigation} empty="Nothing saved yet. Tap Save on a listing to keep it here." />
</View>;

// Only a worded basis ("per item", "per hour") tells the buyer anything. A bare number such as the seeded "1" would
// render as "PHP 150 1", so it is left out rather than shown as noise.
const basisNote = (b?: string) => (b && /[a-z]/i.test(b) ? ` · ${b}` : '');

function Listing({ route, navigation }: any) {
  const t = useTheme(); const { me } = useContext(Auth); const [l, setL] = useState<any>(null); const [body, setBody] = useState(''); const [note, setNote] = useState('');
  useEffect(() => { api(`/listings/${route.params.id}`).then(setL).catch(() => setNote('This listing is not available.')); }, []);
  if (!l) return <Empty text={note || 'Loading'} />;
  const act = async (fn: () => Promise<any>, ok: string) => { try { await fn(); setNote(ok); } catch (e) { setNote(explain(e)); } };
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
      <Field placeholder="Is this still available?" value={body} onChangeText={setBody} multiline style={{ minHeight: 80 }} accessibilityLabel="Message to seller" />
      <Btn label="Send inquiry" disabled={!body.trim() || l.availability !== 'available' || me?.storeId === l.seller.id} onPress={() => act(async () => { await api('/inquiries', { listingId: l.id, body }); setBody(''); }, 'Message sent. Continue in Messages.')} />
      {me?.storeId !== l.seller.id && l.availability === 'available' && <Btn kind="ghost" label="Save" onPress={() => act(() => api(`/saved/${l.id}`, undefined, 'PUT'), 'Saved. Find it under Profile, Saved listings.')} />}
      <Btn kind="ghost" label="Report listing" onPress={() => act(() => api('/reports', { listingId: l.id, reason: 'Reported from the mobile app for review' }), 'Report sent to a campus reviewer.')} />
    </> : <Btn label="Sign in to message the seller" onPress={() => navigation.navigate('Auth')} />}
    {!!note && <Text accessibilityLiveRegion="polite" style={{ color: t.ink }}>{note}</Text>}
  </ScrollView>;
}

function Inquiries({ navigation }: any) {
  const t = useTheme(); const { me } = useContext(Auth); const [rows, setRows] = useState<any[]>([]);
  useEffect(() => { if (me) api('/inquiries').then(setRows).catch(() => {}); }, [me]);
  if (!me) return <Gate nav={navigation} />;
  return <FlatList style={{ backgroundColor: t.bg }} data={rows} keyExtractor={r => String(r.id)} contentContainerStyle={{ padding: 12 }}
    ListEmptyComponent={<Empty text="No conversations yet. Open a listing and message the seller." />}
    renderItem={({ item }) => <Pressable onPress={() => navigation.navigate('Thread', { id: item.id })} style={{ padding: 12, backgroundColor: t.card, borderRadius: 10, marginBottom: 8, borderWidth: 1, borderColor: t.line }}>
      <Text style={{ color: t.ink, fontWeight: '700' }}>{item.listing.title}</Text><Text style={{ color: t.soft }} numberOfLines={1}>{item.lastMessage?.body}</Text></Pressable>} />;
}
function Thread({ route }: any) {
  const t = useTheme(); const [d, setD] = useState<any>(null); const [body, setBody] = useState('');
  const load = () => api(`/inquiries/${route.params.id}/messages`).then(setD).catch(() => {});
  useEffect(() => { load(); const timer = setInterval(load, 3000); return () => clearInterval(timer); }, []);
  if (!d) return <ActivityIndicator style={{ marginTop: 40 }} />;
  return <View style={{ flex: 1, backgroundColor: t.bg }}>
    <FlatList data={d.messages} keyExtractor={m => String(m.id)} contentContainerStyle={{ padding: 12 }}
      renderItem={({ item }) => <View style={{ alignSelf: item.mine ? 'flex-end' : 'flex-start', maxWidth: '80%', padding: 10, borderRadius: 10, marginBottom: 6, backgroundColor: item.mine ? t.mangoSoft : t.card, borderWidth: 1, borderColor: t.line }}>
        <Text style={{ color: t.ink }}>{item.body}</Text></View>} />
    <View style={{ flexDirection: 'row', gap: 8, padding: 12 }}><Field style={{ flex: 1 }} value={body} onChangeText={setBody} placeholder="Reply" accessibilityLabel="Reply" />
      <Btn label="Send" disabled={!body.trim()} onPress={async () => { await api(`/inquiries/${route.params.id}/messages`, { body }).catch(() => {}); setBody(''); load(); }} /></View></View>;
}

function Gate({ nav }: any) { const t = useTheme(); return <View style={{ flex: 1, padding: 24, justifyContent: 'center', gap: 12, backgroundColor: t.bg }}><Text style={{ color: t.ink, fontSize: 20, fontWeight: '800' }}>Sign in to continue</Text><Btn label="Sign in or create account" onPress={() => nav.navigate('Auth')} /></View>; }
function AuthScreen({ navigation }: any) {
  const t = useTheme(); const { reload } = useContext(Auth); const [reg, setReg] = useState(false); const [f, setF] = useState({ email: '', password: '', displayName: '' }); const [campuses, setCampuses] = useState<any[]>([]); const [campusId, setCampusId] = useState<number | null>(null); const [err, setErr] = useState('');
  useEffect(() => { api('/campuses').then(setCampuses).catch(() => {}); }, []);
  const go = async () => { try { await signIn(reg ? '/auth/register' : '/auth/login', reg ? { ...f, campusId } : { email: f.email, password: f.password }); await reload(); navigation.goBack(); } catch (e) { setErr(explain(e)); } };
  return <ScrollView style={{ backgroundColor: t.bg }} contentContainerStyle={{ padding: 20, gap: 12 }}>
    <Text style={{ color: t.ink, fontSize: 26, fontWeight: '800' }}>{reg ? 'Create your account' : 'Sign in'}</Text>
    {reg && <Field placeholder="Name shown to others" value={f.displayName} onChangeText={v => setF({ ...f, displayName: v })} />}
    <Field placeholder="Email" autoCapitalize="none" keyboardType="email-address" value={f.email} onChangeText={v => setF({ ...f, email: v })} />
    <Field placeholder={reg ? 'Password (10+ characters)' : 'Password'} secureTextEntry value={f.password} onChangeText={v => setF({ ...f, password: v })} />
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
  const t = useTheme(); const { me, out } = useContext(Auth); const [mine, setMine] = useState<any[]>([]); const [notifs, setNotifs] = useState<any[]>([]);
  const heading = { color: t.ink, fontSize: 18, fontWeight: '700' as const, marginTop: 16, marginBottom: 4 };
  const loadNotifs = () => api('/notifications').then(setNotifs).catch(() => {});
  useEffect(() => { if (me?.storeId) api('/seller/listings').then(setMine).catch(() => {}); if (me) loadNotifs(); }, [me]);
  if (!me) return <Gate nav={navigation} />;
  const unread = notifs.filter(n => !n.readAt).length;
  const markAll = async () => { await api('/notifications/read', {}).catch(() => {}); loadNotifs(); };
  return <ScrollView style={{ backgroundColor: t.bg }} contentContainerStyle={{ padding: 16, gap: 10 }}>
    <Text style={{ color: t.ink, fontSize: 22, fontWeight: '800' }}>{me.displayName}</Text>
    {me.affiliations.map(a => <Text key={a.id} style={{ color: t.soft }}>{a.campus.name}: {a.status}</Text>)}

    <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }}><Text style={heading}>Notifications</Text>
      {unread > 0 && <Pressable onPress={markAll} accessibilityRole="button" accessibilityLabel={`Mark ${unread} notifications as read`}>
        <Text style={{ color: t.leaf, fontWeight: '700' }}>Mark all read ({unread})</Text></Pressable>}</View>
    {notifs.length === 0 && <Text style={{ color: t.soft }}>Nothing yet. Listing decisions and inquiry replies appear here.</Text>}
    {notifs.slice(0, 6).map(n => <View key={n.id} style={{ padding: 10, backgroundColor: t.card, borderRadius: 8, borderWidth: 1, borderColor: n.readAt ? t.line : t.leaf }}>
      <Text style={{ color: t.ink }}>{notifText(n)}</Text>
      <Text style={{ color: t.soft, fontSize: 12 }}>{new Date(n.createdAt).toLocaleDateString()}{n.readAt ? '' : ', unread'}</Text></View>)}

    <Text style={heading}>My listings</Text>
    {!me.storeId && <Text style={{ color: t.soft }}>Open a store on the website once a campus reviewer verifies your affiliation.</Text>}
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
