import {buildScene} from './scenes.js';
self.onmessage=({data:world})=>{
 try{
  const scene=buildScene('world',world);
  delete scene.height;
  self.postMessage({scene},[scene.geometry.buffer]);
 }catch(error){self.postMessage({error:error.message})}
};
