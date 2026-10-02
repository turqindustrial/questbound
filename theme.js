import {Platform} from 'react-native';
// Shared visual language: dark red on black with purple accents, engraved display type and storybook serif narration.
// The colour names are from the first look (candlelit gold on ink) and are kept so every screen still reads the same
// tokens: `gold` is the theme's red (key text, icons, edges), `goldMid` its purple accent (small labels, marks),
// `goldBright` the pale violet of whatever is selected or lit, `goldDeep`/`goldLine`/`goldFaint` the dark red of
// rules and borders. Real gold (coins) is `coin`. Meaning keeps its own colours whatever the theme: healing green,
// arcane teal, danger and enemy red-orange (`blood`), warnings in amber.
const web=Platform.OS==='web';
export const fonts={
 logo:web?'"Cinzel Decorative", "Cinzel", Georgia, serif':'Georgia',
 display:web?'"Cinzel", "Trajan Pro", Georgia, serif':'Georgia',
 story:web?'"EB Garamond", Garamond, Georgia, serif':'Georgia',
 ui:web?'"Inter", "Segoe UI", system-ui, sans-serif':undefined,
};
export const colors={
 ink:'#08060a',ink2:'#130e15',ink3:'#1f1821',
 gold:'#e04a5c',goldBright:'#eadaff',goldMid:'#b08cf5',goldDeep:'#7d1b2e',goldLine:'rgba(178,34,58,.6)',goldFaint:'rgba(178,34,58,.24)',
 accent:'#b08cf5',accentDeep:'#5b34a8',coin:'#e8c77b',
 parchment:'#f4ecee',text:'#ddd6db',muted:'#a99fa7',faint:'#7a707a',
 blood:'#c8412f',bloodBright:'#f06a4f',heal:'#6fbf8e',arcane:'#6fd0c4',danger:'#ffb3ac',
};
export const type={
 eyebrow:{fontFamily:fonts.display,fontSize:11,letterSpacing:3.2,color:colors.goldMid,textTransform:'uppercase'},
 heading:{fontFamily:fonts.display,fontSize:24,fontWeight:'700',letterSpacing:1,color:colors.parchment},
 subheading:{fontFamily:fonts.display,fontSize:16,fontWeight:'600',letterSpacing:1.2,color:colors.gold},
 story:{fontFamily:fonts.story,fontSize:19,lineHeight:30,color:'#ece4e2'},
 body:{fontFamily:fonts.ui,fontSize:15,lineHeight:24,color:colors.text},
 caption:{fontFamily:fonts.ui,fontSize:12.5,lineHeight:19,color:colors.muted},
 label:{fontFamily:fonts.display,fontSize:10,letterSpacing:2,color:colors.goldMid,textTransform:'uppercase'},
};
