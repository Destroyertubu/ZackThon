"""Independent OpenGL ES 3 / EGL offscreen shader+geometry check.
Not a browser WebGL test. Uses original JS-exported geometry and original shader source.
"""
import ctypes as C,re,json
from pathlib import Path
import numpy as np
from PIL import Image
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'reports'/'native'
E=C.CDLL('libEGL.so.1');G=C.CDLL('libGL.so.1')
def bind(lib,name,restype,args):
 f=getattr(lib,name);f.restype=restype;f.argtypes=args;return f
ptr=C.c_void_p;I=C.c_int;U=C.c_uint;F=C.c_float
getdisp=bind(E,'eglGetPlatformDisplay',ptr,[U,ptr,C.POINTER(I)])
disp=getdisp(0x31DD,None,None)
major=I();minor=I();assert bind(E,'eglInitialize',U,[ptr,C.POINTER(I),C.POINTER(I)])(disp,C.byref(major),C.byref(minor))
assert bind(E,'eglBindAPI',U,[U])(0x30A0)
a=(I*13)(0x3033,1,0x3040,0x40,0x3024,8,0x3023,8,0x3022,8,0x3025,24,0x3038)
config=ptr();num=I();assert bind(E,'eglChooseConfig',U,[ptr,C.POINTER(I),C.POINTER(ptr),I,C.POINTER(I)])(disp,a,C.byref(config),1,C.byref(num)) and num.value
ca=(I*3)(0x3098,3,0x3038);context=bind(E,'eglCreateContext',ptr,[ptr,ptr,ptr,C.POINTER(I)])(disp,config,None,ca)
sa=(I*5)(0x3057,1440,0x3056,1000,0x3038);surface=bind(E,'eglCreatePbufferSurface',ptr,[ptr,ptr,C.POINTER(I)])(disp,config,sa)
assert bind(E,'eglMakeCurrent',U,[ptr,ptr,ptr,ptr])(disp,surface,surface,context)
shader=bind(G,'glCreateShader',U,[U]);source=bind(G,'glShaderSource',None,[U,I,C.POINTER(C.c_char_p),C.POINTER(I)]);compile=bind(G,'glCompileShader',None,[U]);getshader=bind(G,'glGetShaderiv',None,[U,U,C.POINTER(I)]);slog=bind(G,'glGetShaderInfoLog',None,[U,I,C.POINTER(I),C.c_char_p]);createprogram=bind(G,'glCreateProgram',U,[]);attach=bind(G,'glAttachShader',None,[U,U]);link=bind(G,'glLinkProgram',None,[U]);getprogram=bind(G,'glGetProgramiv',None,[U,U,C.POINTER(I)])
text=(ROOT/'frontend/engine/renderer.js').read_text()
def program(v,f):
 pr=createprogram()
 for name,kind in [(v,0x8B31),(f,0x8B30)]:
  code=re.search(r'const '+name+r'=`(.*?)`;',text,re.S).group(1).encode();s=shader(kind);arr=(C.c_char_p*1)(code);source(s,1,arr,None);compile(s);ok=I();getshader(s,0x8B81,C.byref(ok))
  if not ok.value:
   buf=C.create_string_buffer(4096);slog(s,4096,None,buf);raise RuntimeError(buf.value.decode())
  attach(pr,s)
 link(pr);ok=I();getprogram(pr,0x8B82,C.byref(ok));assert ok.value
 return pr
pr=program('VS','FS');tp=program('TVS','TFS');print('All geometry and SDF shaders compiled and linked under EGL GLES3')
bind(G,'glUseProgram',None,[U])(pr)
bind(G,'glEnable',None,[U])(0x0B71);bind(G,'glDisable',None,[U])(0x0B44)
genvao=bind(G,'glGenVertexArrays',None,[I,C.POINTER(U)]);vao=U();genvao(1,C.byref(vao));bind(G,'glBindVertexArray',None,[U])(vao)
genbuf=bind(G,'glGenBuffers',None,[I,C.POINTER(U)]);buf=U();genbuf(1,C.byref(buf));bind(G,'glBindBuffer',None,[U,U])(0x8892,buf)
uniform=bind(G,'glGetUniformLocation',I,[U,C.c_char_p]);um=bind(G,'glUniformMatrix4fv',None,[I,I,U,C.POINTER(F)]);u3=bind(G,'glUniform3fv',None,[I,I,C.POINTER(F)]);u1=bind(G,'glUniform1f',None,[I,F]);bufferdata=bind(G,'glBufferData',None,[U,C.c_size_t,ptr,U]);attrib=bind(G,'glVertexAttribPointer',None,[U,I,U,U,I,ptr]);enableattr=bind(G,'glEnableVertexAttribArray',None,[U]);draw=bind(G,'glDrawArrays',None,[U,I,I]);read=bind(G,'glReadPixels',None,[I,I,I,I,U,U,ptr]);clearcolor=bind(G,'glClearColor',None,[F,F,F,F]);clear=bind(G,'glClear',None,[U]);bind(G,'glViewport',None,[I,I,I,I])(0,0,1440,1000)
for kind in ['home','world']:
 d=json.loads((OUT/(kind+'.json')).read_text());geometry=np.fromfile((OUT/(kind+'.bin')),dtype='float32');bufferdata(0x8892,geometry.nbytes,geometry.ctypes.data,0x88E4)
 for i in range(3):enableattr(i);attrib(i,3,0x1406,0,36,ptr(i*12))
 um(uniform(pr,b'vp'),1,0,(F*16)(*d['vp']));u3(uniform(pr,b'eye'),1,(F*3)(*d['eye']));u3(uniform(pr,b'fog'),1,(F*3)(*d['fog']));u1(uniform(pr,b'fogDistance'),d['fogDistance']);clearcolor(*d['fog'],1);clear(0x4000|0x0100);draw(0x0004,0,d['vertices']);pixels=np.zeros((1000,1440,4),dtype=np.uint8);read(0,0,1440,1000,0x1908,0x1401,pixels.ctypes.data);Image.fromarray(pixels[::-1]).convert('RGB').save((OUT/('native-'+kind+'.png')));print(kind,'unique colors',len(np.unique(pixels.reshape(-1,4),axis=0)))
