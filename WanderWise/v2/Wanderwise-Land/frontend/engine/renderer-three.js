import * as T from '../vendor/three/three.module.js';
export function disposeTree(root) {
 if(!root)return;const gs=new Set(),ms=new Set(),ts=new Set();
 root.traverse(o=>{if(o.isInstancedMesh)o.dispose();if(o.geometry)gs.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:o.material?[o.material]:[]){ms.add(m);for(const v of Object.values(m))if(v?.isTexture)ts.add(v)}});
 ts.forEach(t=>{t.dispose();t.source?.data?.close?.()});ms.forEach(m=>m.dispose());gs.forEach(g=>g.dispose());root.removeFromParent();
}
// One renderer and one render at end(). draw() only marks a batch visible.
export class Renderer {
 constructor(canvas){
  this.canvas=canvas;this.webgl=new T.WebGLRenderer({canvas,antialias:true,alpha:false,powerPreference:'high-performance'});
  this.webgl.outputColorSpace=T.SRGBColorSpace;this.webgl.toneMapping=T.ACESFilmicToneMapping;this.webgl.toneMappingExposure=1.08;
  this.webgl.shadowMap.enabled=true;this.webgl.shadowMap.type=T.PCFSoftShadowMap;this.webgl.info.autoReset=false;
  this.scene=new T.Scene();this.camera=new T.PerspectiveCamera(65,1,.08,650);this.vp=new Float32Array(16);this.matrix=new T.Matrix4();this.labelPoint=new T.Vector3();this.labelRects=[];
  this.batches=new Map();this.textures=new Map();this.labels=new T.Group();this.scene.add(this.labels);
  this.legacyMaterial=new T.MeshStandardMaterial({vertexColors:true,roughness:.94,side:T.DoubleSide});
  this.hemi=new T.HemisphereLight(0xdce9e5,0x8c6444,1.3);this.ambient=new T.AmbientLight(0xffdfb5,.35);this.sun=new T.DirectionalLight(0xffe6c2,3.1);
  this.sun.castShadow=true;this.sun.shadow.mapSize.set(2048,2048);Object.assign(this.sun.shadow.camera,{left:-9,right:9,top:8,bottom:-8,near:.3,far:35});
  this.sun.shadow.bias=-.00015;this.sun.shadow.normalBias=.025;
  this.lamps=[new T.PointLight(0xffcb83,12,6,2),new T.PointLight(0xffcd8d,10,6,2),new T.PointLight(0xffddb0,0,7,2),new T.PointLight(0xffd699,0,4,2)];
  this.scene.add(this.hemi,this.ambient,this.sun,this.sun.target,...this.lamps);this.metrics={drawCalls:0,triangles:0};
  // Low-resolution studio-style environment, generated once for PBR reflections.
  // This is an ambient approximation, not a baked lightmap or a displayed background.
  const environment=new T.Scene();environment.background=new T.Color(.32,.30,.26);
  const room=new T.Mesh(new T.BoxGeometry(12,8,12),new T.MeshBasicMaterial({color:0x70604c,side:T.BackSide}));environment.add(room);
  const panel=new T.Mesh(new T.PlaneGeometry(4,3),new T.MeshBasicMaterial({color:new T.Color(3.0,3.3,3.5),side:T.DoubleSide}));panel.position.set(2,1,-5);environment.add(panel);
  const warm=new T.Mesh(new T.PlaneGeometry(2,2),new T.MeshBasicMaterial({color:new T.Color(1.4,.9,.45),side:T.DoubleSide}));warm.position.set(-4,0,0);warm.rotation.y=Math.PI/2;environment.add(warm);
  const generator=new T.PMREMGenerator(this.webgl);this.homeEnvironment=generator.fromScene(environment,.05,.1,20,{size:128});generator.dispose();disposeTree(environment);
 }
 setLoop(cb){this.webgl.setAnimationLoop(cb)}
 configure(kind,rig=null,camera=null){
  this.camera.far=kind==='home'&&rig?2500:650;this.camera.fov=camera?.fov||65;this.camera.updateProjectionMatrix();
  this.kind=kind;this.sun.color.set(0xffe6c2);this.sun.castShadow=kind==='home';this.sun.position.set(...(kind==='home'?[3.5,5.5,-8]:[-30,65,20]));this.sun.target.position.set(...(kind==='home'?[0,0,1]:[0,0,0]));
  this.sun.intensity=kind==='home'?3.8:2.1;this.hemi.intensity=kind==='home'?.75:1.7;this.ambient.intensity=kind==='home'?.12:.1;
  this.scene.environment=kind==='home'?this.homeEnvironment.texture:null;this.scene.environmentIntensity=.48;
  this.lamps[0].position.set(2.82,1.31,-3.75);this.lamps[1].position.set(-5.19,1.30,.59);this.lamps[0].intensity=8;this.lamps[1].intensity=9;this.lamps[2].intensity=0;this.lamps[3].intensity=0;this.lamps.forEach(l=>l.visible=kind==='home');
  this.scene.background=new T.Color(kind==='home'?'#b6b9a1':'#90af9f');this.scene.fog=new T.Fog(this.scene.background,kind==='home'?35:95,kind==='home'?95:290);
  if(kind==='home'&&rig){this.sun.position.fromArray(rig.key.position);this.sun.target.position.fromArray(rig.key.target);this.sun.color.set(rig.key.color_srgb);this.sun.intensity=rig.key.intensity_start;this.scene.environmentIntensity=rig.environment.intensity_start;this.lamps.forEach((lamp,i)=>{const spec=rig.practicals?.active?.[i];lamp.visible=!!spec;if(spec){lamp.position.fromArray(spec.position);lamp.intensity=spec.intensity;lamp.distance=spec.distance}});this.hemi.intensity=rig.environment.hemisphere_intensity??.9;this.ambient.intensity=rig.environment.ambient_intensity??.23;this.scene.background.set('#b8cbd9');this.scene.fog=new T.Fog('#b8cbd9',180,1600);}
 }
 setCutaway(enabled){
  if(enabled&&!this.cutawayBackground){this.cutawayBackground=this.scene.background.clone();this.scene.background.set('#171d19')}else if(!enabled&&this.cutawayBackground){this.scene.background.copy(this.cutawayBackground);this.cutawayBackground=null}
  this.webgl.clippingPlanes=enabled?[new T.Plane(new T.Vector3(-1,0,0),5.75),new T.Plane(new T.Vector3(0,0,-1),4.75)]:[];
  this.root?.traverse(o=>{if(/^WW_A0[67]$/.test(o.name)||/^WW_E0[1235]$/.test(o.name))o.visible=!enabled});
 }
 install(root){this.root=root;if(root)this.scene.add(root)}
 detach(){this.root?.removeFromParent();this.root=null}
 upload(name,source,dynamic=false){
  let b=this.batches.get(name);
  if(!b||b.capacity<source.length||(!dynamic&&b.capacity!==source.length)){
   if(b){b.mesh.removeFromParent();b.geometry.dispose()}
   const capacity=dynamic?Math.max(source.length,32769):source.length,array=new Float32Array(capacity),buffer=new T.InterleavedBuffer(array,9);
   if(dynamic)buffer.setUsage(T.DynamicDrawUsage);const geometry=new T.BufferGeometry();
   for(const [i,n] of ['position','normal','color'].entries())geometry.setAttribute(n,new T.InterleavedBufferAttribute(buffer,3,i*3));
   const mesh=new T.Mesh(geometry,this.legacyMaterial);mesh.frustumCulled=false;mesh.castShadow=dynamic;mesh.receiveShadow=true;
   this.scene.add(mesh);b={mesh,geometry,buffer,array,capacity};this.batches.set(name,b);
  }
  b.array.set(source);
  // Old colors were authored in sRGB; vertex attributes use linear values.
  for(let i=6;i<source.length;i+=9)for(let j=0;j<3;j++){const c=source[i+j];b.array[i+j]=c<=.04045?c/12.92:Math.pow((c+.055)/1.055,2.4)}
  b.buffer.needsUpdate=true;b.geometry.setDrawRange(0,source.length/9);
 }
 clearText(){for(const t of this.textures.values()){t.sprite.removeFromParent();t.texture.dispose();t.material.dispose()}this.textures.clear()}
 textTexture(text,maxChars=20,style='facility',accent='#dec18b'){
  const key=[style,accent,maxChars,text].join(':');if(this.textures.has(key))return this.textures.get(key);
  const c=document.createElement('canvas'),ctx=c.getContext('2d'),lines=[];let line='';
  for(const char of text){if(char==='\n'||[...line].length>=maxChars){lines.push(line);line='';if(char==='\n')continue}line+=char}if(line)lines.push(line);lines.splice(4);if(!lines.length)lines.push('');
  const quote=style.startsWith('quote'),meta=style==='meta',topic=style==='topic',font=meta?36:48,pad=quote?42:28,lineHeight=meta?48:66;
  const fontStyle=quote?'500 48px "Songti SC", "Noto Serif CJK SC", "SimSun", serif':`${topic?'700':'600'} ${font}px "PingFang SC", "Microsoft YaHei", sans-serif`;
  ctx.font=fontStyle;c.width=Math.min(1536,Math.max(144,...lines.map(l=>ctx.measureText(l).width))+pad*2);c.height=lines.length*lineHeight+pad*2+(topic?8:0);
  ctx.font=fontStyle;ctx.textAlign=quote?'left':'center';ctx.textBaseline='middle';
  ctx.beginPath();ctx.roundRect(3,3,c.width-6,c.height-6,quote?18:meta?24:16);
  ctx.fillStyle=quote?'rgba(250,242,219,.97)':meta?'rgba(18,43,37,.91)':'rgba(17,47,39,.96)';ctx.fill();
  ctx.lineWidth=style==='quote-active'?7:topic?3:2;ctx.strokeStyle=accent;ctx.stroke();
  if(topic){ctx.fillStyle=accent;ctx.fillRect(22,9,c.width-44,5)}
  if(quote){ctx.fillStyle=accent;ctx.fillRect(10,22,5,c.height-44)}
  ctx.fillStyle=quote?'#223e33':meta?accent:'#fff5de';
  lines.forEach((l,i)=>ctx.fillText(l,quote?pad:c.width/2,pad+lineHeight*(i+.5)+(topic?4:0)));
  const texture=new T.CanvasTexture(c);texture.colorSpace=T.SRGBColorSpace;const material=new T.SpriteMaterial({map:texture,transparent:true,depthTest:!(topic||meta),depthWrite:false,toneMapped:false});
  const sprite=new T.Sprite(material);sprite.userData.labelStyle=style;this.labels.add(sprite);const item={texture,material,sprite,aspect:c.width/c.height,lines:lines.length,pixelHeight:c.height,fontSize:font};this.textures.set(key,item);
  if(this.textures.size>80){const [k,old]=this.textures.entries().next().value;old.sprite.removeFromParent();old.texture.dispose();old.material.dispose();this.textures.delete(k)}return item;
 }

 begin(eye,target,{quality='medium'}={}){
  this.labelRects=[];
  const dpr=quality==='low'?1:Math.min(devicePixelRatio,quality==='high'?2:1.4),w=Math.max(1,this.canvas.clientWidth),h=Math.max(1,this.canvas.clientHeight);
  if(this.width!==w||this.height!==h||this.dpr!==dpr){this.width=w;this.height=h;this.dpr=dpr;this.webgl.setPixelRatio(dpr);this.webgl.setSize(w,h,false);this.camera.aspect=w/h;this.camera.updateProjectionMatrix()}
  if(this.quality!==quality){this.quality=quality;const size=quality==='low'?1024:2048;this.sun.shadow.mapSize.set(size,size);this.sun.shadow.map?.dispose();this.sun.shadow.map=null;this.sun.shadow.needsUpdate=true}
  this.camera.position.fromArray(eye);this.camera.lookAt(...target);this.camera.updateMatrixWorld();this.matrix.multiplyMatrices(this.camera.projectionMatrix,this.camera.matrixWorldInverse).toArray(this.vp);
  for(const b of this.batches.values())b.mesh.visible=false;for(const t of this.textures.values())t.sprite.visible=false;
 }
 draw(name){const b=this.batches.get(name);if(b)b.mesh.visible=true}
 text(label){
  const t=this.textTexture(label.text,label.maxChars||20,label.style||'facility',label.accent||'#dec18b');let h=(label.height||.75)*t.lines;
  t.sprite.position.fromArray(label.position);
  // Minimum CSS pixel size keeps distant topic signs readable at every DPR.
  if(label.minPixels){const unitsPerPixel=2*this.camera.position.distanceTo(t.sprite.position)*Math.tan(this.camera.fov*Math.PI/360)/Math.max(1,this.height);h=Math.max(h,unitsPerPixel*label.minPixels*t.pixelHeight/t.fontSize)}
  if(label.avoidOverlap){
   const depth=-this.labelPoint.copy(t.sprite.position).applyMatrix4(this.camera.matrixWorldInverse).z;
   if(depth<=this.camera.near)return false;
   const ndc=this.labelPoint.copy(t.sprite.position).project(this.camera),ph=h*this.height/(2*depth*Math.tan(this.camera.fov*Math.PI/360)),pw=ph*t.aspect;
   const x=(ndc.x+1)*this.width/2,y=(1-ndc.y)*this.height/2,rect={left:x-pw/2-6,right:x+pw/2+6,top:y-ph/2-6,bottom:y+ph/2+6};
   if(rect.right<0||rect.left>this.width||rect.bottom<0||rect.top>this.height)return false;
   if(this.labelRects.some(r=>rect.left<r.right&&rect.right>r.left&&rect.top<r.bottom&&rect.bottom>r.top))return false;
   this.labelRects.push(rect);
  }
  t.sprite.visible=true;t.sprite.scale.set(h*t.aspect,h,1);t.material.opacity=label.opacity??1;return true;
 }

 end(){this.webgl.info.reset();this.webgl.render(this.scene,this.camera);const i=this.webgl.info;this.metrics={drawCalls:i.render.calls,triangles:i.render.triangles,geometries:i.memory.geometries,textures:i.memory.textures,programs:i.programs.length,labels:this.textures.size}}
 async compile(){await this.webgl.compileAsync(this.scene,this.camera)}
 dispose(){this.setLoop(null);this.detach();this.clearText();for(const b of this.batches.values()){b.mesh.removeFromParent();b.geometry.dispose()}this.batches.clear();this.legacyMaterial.dispose();this.sun.shadow.map?.dispose();this.homeEnvironment?.dispose();this.webgl.dispose()}
}
