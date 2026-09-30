import React from 'react';
import {Text,Platform} from 'react-native';
import {iconPaths} from './iconPaths';
const web=Platform.OS==='web';
// One of Questbound's line icons, drawn in the current text colour (or `color`). On the web it is an inline SVG;
// elsewhere it falls back to a matching text glyph.
export default function Icon({name,size=18,color,strokeWidth=1.6,style}){
 const icon=iconPaths[name]??iconPaths.star;
 if(!web)return <Text style={[{fontSize:size*.9,lineHeight:size,color,textAlign:'center',minWidth:size},style]}>{icon.glyph}</Text>;
 return React.createElement('svg',{viewBox:'0 0 24 24',width:size,height:size,fill:'none',stroke:'currentColor',strokeWidth,strokeLinecap:'round',strokeLinejoin:'round','aria-hidden':true,focusable:'false',
  style:{display:'block',flexShrink:0,color,overflow:'visible',...(Array.isArray(style)?Object.assign({},...style.filter(Boolean)):style)},dangerouslySetInnerHTML:{__html:icon.svg}});
}
