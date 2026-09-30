import {Platform} from 'react-native';
// Shared visual language: candlelit gold on deep ink, engraved display type and storybook serif narration.
const web=Platform.OS==='web';
export const fonts={
 logo:web?'"Cinzel Decorative", "Cinzel", Georgia, serif':'Georgia',
 display:web?'"Cinzel", "Trajan Pro", Georgia, serif':'Georgia',
 story:web?'"EB Garamond", Garamond, Georgia, serif':'Georgia',
 ui:web?'"Inter", "Segoe UI", system-ui, sans-serif':undefined,
};
export const colors={
 ink:'#06080c',ink2:'#0c1018',ink3:'#141a26',
 gold:'#e8c77b',goldBright:'#fff1c7',goldMid:'#c9a45c',goldDeep:'#8a6a35',goldLine:'rgba(201,164,92,.45)',goldFaint:'rgba(201,164,92,.18)',
 parchment:'#f1e6cc',text:'#d6dae3',muted:'#9ba4b6',faint:'#6f7890',
 blood:'#c8412f',bloodBright:'#f06a4f',heal:'#6fbf8e',arcane:'#6fd0c4',danger:'#ffb3ac',
};
export const type={
 eyebrow:{fontFamily:fonts.display,fontSize:11,letterSpacing:3.2,color:colors.goldMid,textTransform:'uppercase'},
 heading:{fontFamily:fonts.display,fontSize:24,fontWeight:'700',letterSpacing:1,color:colors.parchment},
 subheading:{fontFamily:fonts.display,fontSize:16,fontWeight:'600',letterSpacing:1.2,color:colors.gold},
 story:{fontFamily:fonts.story,fontSize:19,lineHeight:30,color:'#ece4d2'},
 body:{fontFamily:fonts.ui,fontSize:15,lineHeight:24,color:colors.text},
 caption:{fontFamily:fonts.ui,fontSize:12.5,lineHeight:19,color:colors.muted},
 label:{fontFamily:fonts.display,fontSize:10,letterSpacing:2,color:colors.goldMid,textTransform:'uppercase'},
};
