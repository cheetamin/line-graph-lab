# 참고 화면에서 장식(소나무·학·정자·책·벼루·등불·매화)을 잘라 투명 배경 WebP로 만드는 스크립트
# 사용: python3 scripts/extract-deco.py <참고이미지폴더>/
from PIL import Image, ImageFilter, ImageChops, ImageDraw
import numpy as np
import sys
R=sys.argv[1] if len(sys.argv)>1 else 'references/'  # 참고 이미지 폴더
I=Image.open(R+'selected_traditional_intro_ui.png').convert('RGB')
G=Image.open(R+'selected_traditional_gallery_ui.png').convert('RGB')
OUT='public/assets/deco/'
import os; os.makedirs(OUT,exist_ok=True)

def edge_feather(w,h,f):
    m=np.ones((h,w),np.float32)
    for i in range(f):
        v=(i+1)/f
        m[i,:]=np.minimum(m[i,:],v); m[h-1-i,:]=np.minimum(m[h-1-i,:],v)
        m[:,i]=np.minimum(m[:,i],v); m[:,w-1-i]=np.minimum(m[:,w-1-i],v)
    return m

def key(img, box, name, feather=24, strength=1.0, sat_w=2.2, kill=None, scale=1.0):
    c=img.crop(box)
    a=np.asarray(c).astype(np.float32)/255
    paper=np.asarray(c.filter(ImageFilter.MedianFilter(5)).resize((max(1,c.width//24),max(1,c.height//24)),Image.BILINEAR).filter(ImageFilter.MaxFilter(3)).resize(c.size,Image.BILINEAR)).astype(np.float32)/255
    lum=a@[.299,.587,.114]; plum=paper@[.299,.587,.114]
    lt=np.clip((plum-lum)/(plum*0.5+1e-3),0,1)
    sat=a.max(2)-a.min(2); psat=paper.max(2)-paper.min(2)
    # 종이색과 다른 색(매화 분홍, 붉은색)
    dist=np.sqrt(((a-paper)**2).sum(2))
    st=np.clip((dist-0.06)*sat_w,0,1)
    al=np.clip(np.maximum(lt,st)*strength,0,1)**0.85
    al*=edge_feather(c.width,c.height,feather)
    if kill is not None:
        m=Image.new('L',c.size,255); d=ImageDraw.Draw(m)
        for poly in kill: d.polygon([(x-box[0],y-box[1]) for x,y in poly],fill=0)
        m=m.filter(ImageFilter.GaussianBlur(12))
        al*=np.asarray(m).astype(np.float32)/255
    # 색 되돌리기(종이색을 빼서 투명 부분이 누렇게 뜨지 않게)
    aa=np.clip(al,1e-3,1)[...,None]
    col=np.clip((a-paper*(1-aa))/aa,0,1)
    col=np.where(al[...,None]>0.15,col,a)
    rgba=np.dstack([col,al]); im=Image.fromarray((rgba*255).astype(np.uint8),'RGBA')
    if scale!=1.0: im=im.resize((int(im.width*scale),int(im.height*scale)),Image.LANCZOS)
    im.save(OUT+name+'.webp','WEBP',quality=86,method=6); return im

def soft(img, box, name, mask='rect', feather=40, scale=1.0, kill=None, keep=None):
    c=img.crop(box).convert('RGBA'); w,h=c.size
    if mask=='ellipse':
        yy,xx=np.mgrid[0:h,0:w]; d=np.sqrt(((xx-w/2)/(w/2))**2+((yy-h/2)/(h/2))**2)
        m=np.clip((1-d)/0.25,0,1)
    else: m=edge_feather(w,h,feather)
    if kill is not None:
        mm=Image.new('L',c.size,255); dr=ImageDraw.Draw(mm)
        for poly in kill: dr.polygon([(x-box[0],y-box[1]) for x,y in poly],fill=0)
        mm=mm.filter(ImageFilter.GaussianBlur(14)); m=m*np.asarray(mm)/255
    if keep is not None:
        mm=Image.new('L',c.size,0); dr=ImageDraw.Draw(mm); dr.polygon([(x-box[0],y-box[1]) for x,y in keep],fill=255)
        mm=mm.filter(ImageFilter.GaussianBlur(6)); m=np.minimum(m*0+1,np.asarray(mm)/255)*np.maximum(m,0.0) if False else np.asarray(mm)/255
    arr=np.asarray(c).astype(np.float32); arr[...,3]=m*255
    im=Image.fromarray(arr.astype(np.uint8),'RGBA')
    if scale!=1.0: im=im.resize((int(w*scale),int(h*scale)),Image.LANCZOS)
    im.save(OUT+name+'.webp','WEBP',quality=86,method=6); return im

out={}
out['pine']=key(I,(88,0,610,168),'pine',feather=20)
out['crane']=key(I,(945,30,1200,195),'crane',feather=14)
out['cloud1']=key(I,(100,330,265,455),'cloud1',feather=14)
out['cloud2']=key(I,(1285,65,1465,135),'cloud2',feather=12)
out['cloud3']=key(I,(1000,580,1200,650),'cloud3',feather=12)
out['pavilion']=key(I,(90,512,500,880),'pavilion',feather=26,kill=[[(0,650),(305,700),(305,941),(0,941)],[(250,500),(510,500),(510,588),(250,588)],[(415,585),(510,585),(510,645),(415,645)]])
out['mountR']=key(I,(1170,640,1385,862),'mount_right',feather=26)
out['books']=soft(I,(0,640,310,941),'books_stack',keep=[(0,655),(250,745),(302,782),(302,941),(0,941)])
out['inkstone']=soft(I,(1340,550,1672,941),'inkstone_brush',keep=[(1615,555),(1672,555),(1672,941),(1355,941),(1355,800),(1440,765),(1515,762),(1600,600)])
out['binding']=soft(I,(0,0,108,941),'binding',feather=6)
out['g_plum']=key(G,(186,0,452,150),'plum_top',feather=18)
out['g_pav']=key(G,(1212,0,1392,150),'pavilion_top',feather=18)
out['g_land']=key(G,(1332,640,1585,830),'page_landscape',feather=24)
out['lantern']=soft(G,(0,686,346,941),'lantern_books',keep=[(0,822),(42,818),(42,728),(80,708),(100,688),(122,688),(145,708),(183,728),(183,812),(240,830),(346,872),(346,941),(0,941)])
out['brush']=soft(G,(1232,808,1672,941),'brush_desk',keep=[(1232,941),(1232,918),(1520,822),(1672,810),(1672,941)])
out['lattice']=soft(G,(0,0,190,170),'lattice',feather=20)
