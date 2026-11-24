// Reproducible CSS scale review. Classifications are triage, not approvals.
const fs=require('node:fs'),path=require('node:path'),postcss=require('postcss');
const root=path.resolve(__dirname,'../src');
const scales={spacing:new Set([0,4,8,12,16,24,32,48,64]),type:new Set([12,14,16,18,20,24,30]),radius:new Set([0,6,12,9999])};
const props={spacing:/^(?:padding|margin|gap|row-gap|column-gap|scroll-(?:margin|padding))(?:-|$)/,type:/^font-size$/,radius:/^border-radius$/};
const files=[];
function walk(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory())walk(p);else if(e.isFile()&&p.endsWith('.css'))files.push(p)}}
walk(root);
const entries=[],categories={};
for(const file of files){
 const sheet=postcss.parse(fs.readFileSync(file,'utf8'),{from:file});
 sheet.walkDecls(d=>{
  const group=Object.keys(props).find(k=>props[k].test(d.prop.toLowerCase()));if(!group)return;
  const selector=d.parent?.selector||'(at-rule)';
  for(const m of d.value.matchAll(/(-?\d*\.?\d+)(px|rem)\b/g)){
   const px=Math.round(Number(m[1])*(m[2]==='rem'?16:1)*100)/100;
   if(scales[group].has(px))continue;
   const cat=px<0?'negative-positioning':/\b(?:calc|clamp|min|max|env)\s*\(/.test(d.value)?'responsive-formula':group==='type'&&px>30?'display-type':group==='radius'&&/(chat|bubble|photo|image|hero|card|modal|popover|thumbnail)/i.test(selector)?'shaped-surface-radius':group==='spacing'&&px>64?'large-layout-spacing':'manual-review-static';
   entries.push({file:path.relative(root,file).replace(/\\/g,'/'),line:d.source?.start?.line,selector,property:d.prop,value:m[0],px,category:cat});
   categories[cat]=(categories[cat]||0)+1;
  }
 });
}
const result={cssFiles:files.length,total:entries.length,categories,entries};
if(process.argv.includes('--json'))console.log(JSON.stringify(result,null,2));
else{console.log('CSS scale: '+result.total+' candidates across '+files.length+' CSS files');for(const [k,v]of Object.entries(categories))console.log(' '+k+': '+v);console.log('All remaining candidates require review; classification is not approval.');}
if(process.argv.includes('--strict')&&entries.length)process.exitCode=1;
