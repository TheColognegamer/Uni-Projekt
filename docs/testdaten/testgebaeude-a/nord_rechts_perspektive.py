"""Auswertung Foto Nordseite (rechts vom Fallrohr, 9 Fenster) gegen die Planmaße.
Nur NumPy. Foto liegt nicht im Repo. Eckpunkte wurden per Hand im Foto abgelesen (Ablesefehler ca. ±2 px im Original).
Plan-Lagen stammen aus der CAD-Geometrie der Ansicht Nord (Fenster-Außenrechtecke, M 1:100); das Fenster Achse 4 / OG2 fehlte
in den Vektordaten und ist nach dem Raster der Nachbarn ergänzt.
Methode: Homographie (Foto -> Fassadenebene) aus den oberen linken Ecken der vier äußeren OG-Fenster (nur deren LAGE, nicht deren Größe),
danach werden alle Ecken abgebildet und Breite/Höhe/Fläche je Fenster mit dem Plan (1,342 x 1,40 m) verglichen.
Aufruf: python3 -I nord_rechts_perspektive.py"""
import numpy as np
P={ (2,'OG2'):(28.181,29.523,17.115,18.517),(2,'OG1'):(28.181,29.523,14.372,15.769),(2,'EG'):(28.181,29.523,11.599,13.001),
    (3,'OG2'):(30.599,31.941,17.111,18.508),(3,'OG1'):(30.599,31.941,14.364,15.765),(3,'EG'):(30.599,31.941,11.595,12.996),
    (4,'OG2'):(32.995,34.337,17.111,18.510),(4,'OG1'):(32.995,34.337,14.376,15.778),(4,'EG'):(32.995,34.337,11.608,13.009)}
# Ecken TL,TR,BR,BL, Pixel in einem 2x vergrößerten Ausschnitt (nur Verhältnisse zählen)
C={ (2,'OG2'):[(163,80),(373,103),(371,320),(160,295)],(3,'OG2'):[(548,138),(738,160),(746,362),(551,340)],(4,'OG2'):[(892,185),(1066,207),(1086,403),(908,383)],
    (2,'OG1'):[(143,492),(372,513),(370,766),(140,742)],(3,'OG1'):[(553,540),(755,556),(772,795),(563,772)],(4,'OG1'):[(922,570),(1108,588),(1124,803),(940,797)],
    (2,'EG'):[(123,982),(372,990),(363,1275),(110,1278)],(3,'EG'):[(565,997),(783,1003),(790,1277),(570,1277)],(4,'EG'):[(950,1012),(1158,1018),(1180,1275),(975,1275)]}
SOLL=1.342*1.40
def metric(k): u0,u1,v0,v1=P[k]; return [(u0,v1),(u1,v1),(u1,v0),(u0,v0)]
def dlt(src,dst):
    A=[]
    for (x,y),(u,v) in zip(src,dst): A+=[[x,y,1,0,0,0,-u*x,-u*y,-u],[0,0,0,x,y,1,-v*x,-v*y,-v]]
    H=np.linalg.svd(np.array(A,float))[2][-1].reshape(3,3); return H/H[2,2]
def ap(H,p): q=H@np.array([p[0],p[1],1.0]); return q[:2]/q[2]
def area(p): return abs(sum(p[i][0]*p[(i+1)%4][1]-p[(i+1)%4][0]*p[i][1] for i in range(4)))/2
CTRL=[(2,'OG2'),(4,'OG2'),(2,'OG1'),(4,'OG1')]
def run(Cd):
    H=dlt([Cd[k][0] for k in CTRL],[metric(k)[0] for k in CTRL]); out={}
    for k,cs in Cd.items():
        m=[ap(H,c) for c in cs]
        out[k]=((np.hypot(*(m[1]-m[0]))+np.hypot(*(m[2]-m[3])))/2,(np.hypot(*(m[3]-m[0]))+np.hypot(*(m[2]-m[1])))/2,area(m))
    return out
if __name__=='__main__':
    r=run(C)
    for k in [(a,g) for g in ('OG2','OG1','EG') for a in (2,3,4)]:
        w,h,a=r[k]; print(f"Achse {k[0]} {k[1]}: {w:.2f} x {h:.2f} m = {a:.2f} m² ({(a-SOLL)/SOLL*100:+.1f} %)")
    og=[v[2] for k,v in r.items() if k[1]!='EG']; print(f"OG-Mittel {np.mean(og):.2f} m² ({(np.mean(og)-SOLL)/SOLL*100:+.1f} %), Streuung ±{np.std(og)/np.mean(og)*100:.1f} %")
    rng=np.random.default_rng(1); A=[]
    for _ in range(2000):
        rr=run({k:[(x+rng.normal(0,4),y+rng.normal(0,4)) for x,y in cs] for k,cs in C.items()}); A.append(np.mean([v[2] for k,v in rr.items() if k[1]!='EG']))
    print(f"Ablesefehler ±2 px (Original): OG-Mittel 90 %-Bereich {np.percentile(A,5):.2f}–{np.percentile(A,95):.2f} m²")
    px={k:area(v) for k,v in C.items()}; ogp=[v for k,v in px.items() if k[1]!='EG']
    print(f"OHNE Perspektivkorrektur: Pixelflächen gleicher Fenster ±{np.std(ogp)/np.mean(ogp)*100:.0f} % (max/min {max(ogp)/min(ogp):.2f})")
