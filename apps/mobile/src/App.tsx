import React, { createContext, useContext, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Image, Pressable, RefreshControl, ScrollView, Text, TextInput, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
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

function ListingRow({ l, onPress }: { l: any; onPress: () => void }) {
  const t = useTheme();
  return <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`${l.title}, ${peso(l.price)}`}
    style={{ flexDirection: 'row', gap: 12, padding: 12, backgroundColor: t.card, borderRadius: 10, marginBottom: 10, borderWidth: 1, borderColor: t.line }}>
    <View style={{ width: 84, height: 84, borderRadius: 8, backgroundColor: '#fdebc6', overflow: 'hidden' }}>{l.images?.[0] && <Image source={{ uri: imageUrl(l.images[0]) }} style={{ flex: 1 }} />}</View>
    <View style={{ flex: 1 }}><Text style={{ color: t.ink, fontWeight: '700', fontSize: 16 }}>{l.title}</Text>
      <Text style={{ color: t.soft }}>{l.seller.storeName}, {l.campus.name}</Text>
      <Text style={{ color: t.ink, fontWeight: '800', marginTop: 4, backgroundColor: t.mango, alignSelf: 'flex-start', paddingHorizontal: 8, borderRadius: 4 }}>{peso(l.price)}</Text></View>
  </Pressable>;
}

function ListScreen({ path, empty, nav, query }: { path: string; empty: string; nav: any; query?: string }) {
  const t = useTheme(); const [rows, setRows] = useState<any[] | null>(null); const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  const load = async () => { setBusy(true); try { const r = await api(path + (query ? `${path.includes('?') ? '&' : '?'}q=${encodeURIComponent(query)}` : '')); setRows(r.items ?? r); setErr(''); } catch (e) { setErr(explain(e)); } setBusy(false); };
  useEffect(() => { const id = setTimeout(load, 250); return () => clearTimeout(id); }, [path, query]);
  if (!rows && !err) return <ActivityIndicator style={{ marginTop: 40 }} />;
  return <FlatList data={rows ?? []} keyExtractor={l => String(l.id)} contentContainerStyle={{ padding: 12 }}
    refreshControl={<RefreshControl refreshing={busy} onRefresh={load} />}
    ListEmptyComponent={<Empty text={err || empty} />}
    renderItem={({ item }) => <ListingRow l={item} onPress={() => nav.navigate('Listing', { id: item.id })} />} />;
}

function Explore({ navigation }: any) {
  const t = useTheme(); const [q, setQ] = useState('');
  return <View style={{ flex: 1, backgroundColor: t.bg }}><View style={{ padding: 12, paddingBottom: 0 }}><Field placeholder="Search listings" value={q} onChangeText={setQ} accessibilityLabel="Search listings" /></View>
    <ListScreen path="/listings" query={q} nav={navigation} empty="No listings match yet. Try another search." /></View>;
}
function Categories({ navigation }: any) {
  const t = useTheme(); const [cats, setCats] = useState<any[]>([]); const [sel, setSel] = useState<number | null>(null);
  useEffect(() => { api('/categories').then(setCats).catch(() => {}); }, []);
  return <View style={{ flex: 1, backgroundColor: t.bg }}>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={{ padding: 12, gap: 8 }}>
      {cats.map(c => <Pressable key={c.id} onPress={() => setSel(c.id)} accessibilityRole="button" accessibilityState={{ selected: sel === c.id }}
        style={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: 14, borderRadius: 22, borderWidth: 1, borderColor: t.leaf, backgroundColor: sel === c.id ? t.leaf : 'transparent' }}>
        <Text style={{ color: sel === c.id ? t.onLeaf : t.leaf, fontWeight: '600' }}>{c.name}</Text></Pressable>)}
    </ScrollView>
    {sel ? <ListScreen path={`/listings?categoryId=${sel}`} nav={navigation} empty="Nothing in this category yet." /> : <Empty text="Pick a category to browse." />}</View>;
}
const Saved = ({ navigation }: any) => <ListScreen path="/saved" nav={navigation} empty="Nothing saved yet. Tap Save on a listing to keep it here." />;

function Listing({ route, navigation }: any) {
  const t = useTheme(); const { me } = useContext(Auth); const [l, setL] = useState<any>(null); const [body, setBody] = useState(''); const [note, setNote] = useState('');
  useEffect(() => { api(`/listings/${route.params.id}`).then(setL).catch(() => setNote('This listing is not available.')); }, []);
  if (!l) return <Empty text={note || 'Loading'} />;
  const act = async (fn: () => Promise<any>, ok: string) => { try { await fn(); setNote(ok); } catch (e) { setNote(explain(e)); } };
  return <ScrollView style={{ backgroundColor: t.bg }} contentContainerStyle={{ padding: 16, gap: 12 }}>
    <ScrollView horizontal>{l.images.map((s: string) => <Image key={s} source={{ uri: imageUrl(s) }} accessibilityLabel={l.title} style={{ width: 280, height: 240, borderRadius: 10, marginRight: 8 }} />)}</ScrollView>
    <Text style={{ color: t.ink, fontSize: 24, fontWeight: '800' }}>{l.title}</Text>
    <Text style={{ color: t.ink, fontWeight: '800', backgroundColor: t.mango, alignSelf: 'flex-start', paddingHorizontal: 10, borderRadius: 4 }}>{peso(l.price)} {l.priceBasis}</Text>
    <Text style={{ color: t.ink }}>{l.description}</Text>
    <Text style={{ color: t.soft }}>Sold by {l.seller.storeName} at {l.campus.name}. Payment and handoff are arranged directly with the seller.</Text>
    {me ? <>
      <Field placeholder="Is this still available?" value={body} onChangeText={setBody} multiline style={{ minHeight: 80 }} accessibilityLabel="Message to seller" />
      <Btn label="Send inquiry" disabled={!body.trim()} onPress={() => act(async () => { await api('/inquiries', { listingId: l.id, body }); setBody(''); }, 'Message sent. Continue in Inquiries.')} />
      <Btn kind="ghost" label="Save" onPress={() => act(() => api(`/saved/${l.id}`, undefined, 'PUT'), 'Saved.')} />
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
  useEffect(() => { load(); const t = setInterval(load, 3000); return () => clearInterval(t); }, []);
  if (!d) return <ActivityIndicator style={{ marginTop: 40 }} />;
  return <View style={{ flex: 1, backgroundColor: t.bg }}>
    <FlatList data={d.messages} keyExtractor={m => String(m.id)} contentContainerStyle={{ padding: 12 }}
      renderItem={({ item }) => <View style={{ alignSelf: item.mine ? 'flex-end' : 'flex-start', maxWidth: '80%', padding: 10, borderRadius: 10, marginBottom: 6, backgroundColor: item.mine ? '#fdebc6' : t.card, borderWidth: 1, borderColor: t.line }}>
        <Text style={{ color: item.mine ? '#1b2838' : t.ink }}>{item.body}</Text></View>} />
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

// Seller tools: status and entry points. Listing creation with photos is done on the web dashboard in this first version.
function Profile({ navigation }: any) {
  const t = useTheme(); const { me, out } = useContext(Auth); const [mine, setMine] = useState<any[]>([]);
  useEffect(() => { if (me?.storeId) api('/seller/listings').then(setMine).catch(() => {}); }, [me]);
  if (!me) return <Gate nav={navigation} />;
  return <ScrollView style={{ backgroundColor: t.bg }} contentContainerStyle={{ padding: 16, gap: 10 }}>
    <Text style={{ color: t.ink, fontSize: 22, fontWeight: '800' }}>{me.displayName}</Text>
    {me.affiliations.map(a => <Text key={a.id} style={{ color: t.soft }}>{a.campus.name}: {a.status}</Text>)}
    <Text style={{ color: t.ink, fontSize: 18, fontWeight: '700', marginTop: 12 }}>My listings</Text>
    {!me.storeId && <Text style={{ color: t.soft }}>You can open a store once a campus reviewer verifies your affiliation.</Text>}
    {mine.map(l => <View key={l.id} style={{ padding: 10, backgroundColor: t.card, borderRadius: 8, borderWidth: 1, borderColor: t.line }}>
      <Text style={{ color: t.ink, fontWeight: '600' }}>{l.title}</Text><Text style={{ color: t.soft }}>{l.status.replace('_', ' ')}, {peso(Number(l.price))}</Text></View>)}
    <Btn kind="ghost" label="Sign out" onPress={out} /></ScrollView>;
}

function Main() {
  const t = useTheme();
  return <Tabs.Navigator screenOptions={{ tabBarActiveTintColor: t.leaf, tabBarStyle: { backgroundColor: t.card }, headerStyle: { backgroundColor: t.card }, headerTitleStyle: { color: t.ink } }}>
    <Tabs.Screen name="Explore" component={Explore} /><Tabs.Screen name="Categories" component={Categories} />
    <Tabs.Screen name="Inquiries" component={Inquiries} /><Tabs.Screen name="Saved" component={Saved} /><Tabs.Screen name="Profile" component={Profile} />
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
      <Stack.Screen name="Auth" component={AuthScreen} options={{ title: 'Account', presentation: 'modal' }} /></Stack.Navigator>
  </NavigationContainer><StatusBar style="auto" /></Auth.Provider></SafeAreaProvider>;
}
