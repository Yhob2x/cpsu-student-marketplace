import { useColorScheme } from 'react-native';

// Palette: #0E2815 #295740 #537D5D #E0BB46 #B0D3C2, the same five colours as apps/web. `soft`, `line`, `bg` and `card` are
// tints of those five so the native app matches the web design system; `danger` is the functional colour the palette cannot
// supply. `forest`/`forestInk` are fixed dark-green surfaces (announcement strip, call-to-action band, footer) that carry
// light text in both schemes, exactly as `.strip`/`.cta-band`/`.site-foot` do on the web.
const light = {
  ink: '#0e2815', soft: '#3c5b47', bg: '#f4f9f6', card: '#ffffff', line: '#cbded2',
  leaf: '#295740', mango: '#e0bb46', mangoSoft: '#e9f2ec', mint: '#b0d3c2', danger: '#a12a1c',
  onLeaf: '#ffffff', onMango: '#0e2815', forest: '#0e2815', forestInk: '#cfe3d6',
};
const dark = {
  ink: '#e8f2eb', soft: '#a7c4b4', bg: '#0e2815', card: '#17331f', line: '#23422f',
  leaf: '#b0d3c2', mango: '#e0bb46', mangoSoft: '#213f2e', mint: '#2a4a37', danger: '#f08a7e',
  onLeaf: '#0e2815', onMango: '#0e2815', forest: '#1b3d28', forestInk: '#d6e8dc',
};
export const useTheme = () => (useColorScheme() === 'dark' ? dark : light);
