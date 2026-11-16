/* LCA-Daten: ÖKOBAUDAT-Datensätze, Schichtaufbauten und Annahmen für den GWP-Vergleich der Fassadensanierung.
 * Übernommen aus LCA_Fassadensanierung_WDVS_VHF.xlsx (Blätter Datensaetze, LCA_Schichten, Parameter).
 *
 * HIER ÄNDERN, wenn sich Annahmen ändern (z. B. Nutzungsdauern nach BBSR-Tabelle, Mengen, Verschnitt).
 * Die Rechnung (src/lca.js) und die App passen sich automatisch an; `node tests/lca.test.js` prüft danach,
 * ob die Werte noch zur Excel passen (bei bewusst geänderten Annahmen die Sollwerte im Test anpassen).
 *
 * Einheiten: Dicken in m, Rohdichten in kg/m³, GWP in kg CO₂-Äq. je Bezugseinheit des Datensatzes.
 */
(function (root) {
  'use strict';

  const QUELLE = {
    text: 'ÖKOBAUDAT 2024-II (Datenbestand OBD_2024_II, EN 15804+A2), BBSR/BMWSB, www.oekobaudat.de',
    abgerufen: '15.11.2026',
    norm: 'GWP-total nach DIN EN 15804+A2, Gebäudebilanz nach DIN EN 15978, Module A1–A3 + B4 + C3 + C4 (ohne D)',
  };

  /** Betrachtungszeiträume in Jahren (Vorgabe Aufgabenstellung). */
  const ZEITRAEUME = [30, 50];

  /** Fenstergeometrie, falls keine Fenstermaße aus dem Aufmaß vorliegen (Blatt Parameter). */
  const FENSTER_STANDARD = {
    b: 1.23, h: 1.48,           // Normfenster nach DIN EN 14351-1 (Annahme)
    rahmenanteil: 0.30,         // Anteil Rahmen an der Fensterfläche (Annahme)
    fluegelAbzug: 0.10,         // Flügelrahmen je Richtung kleiner als Blendrahmen (Annahme)
  };

  const L = (uuid, version) => `https://oekobaudat.de/OEKOBAU.DAT/datasetdetail/process.xhtml?uuid=${uuid}&version=${version}&stock=OBD_2024_II&lang=de`;

  /**
   * ÖKOBAUDAT-Datensätze. a1a3/c3/c4 = GWP-total je Bezugseinheit; null = Modul nicht deklariert (zählt als 0).
   * kennwert = Rohdichte bzw. Flächen-/Längen-/Stückgewicht (Einheit in kennwertEinheit).
   */
  const DATENSAETZE = {
    MW_WDVS: { name: 'Mineralwolle-Dämmstoff im mittleren Rohdichtebereich', uuid: '699e3d57-72b4-402d-a0ee-cebb06f3cdf1', version: '00.08.000', typ: 'Durchschnitt (FMI, EPD)', gruppe: '2.1.01 Dämmstoffe / Mineralwolle', einheit: 'm³', kennwert: 100, kennwertEinheit: 'kg/m³', a1a3: 120.8, c3: null, c4: 2.1909, gueltigBis: 2028, hinweis: 'Putzträgerplatte im WDVS; C3 nicht deklariert' },
    MW_VHF: { name: 'Mineralwolle (Fassaden-Dämmung)', uuid: '50d421e2-3a7b-4659-92a4-f20d6a52fcf0', version: '20.26.070', typ: 'generisch (Sphera)', gruppe: '2.1.01 Dämmstoffe / Mineralwolle', einheit: 'm³', kennwert: 46.25, kennwertEinheit: 'kg/m³', a1a3: 66.975, c3: 1.3967, c4: 0.7788, gueltigBis: 2026, hinweis: 'leichte Fassadendämmplatte für hinterlüftete Fassade' },
    EPS15: { name: 'EPS-Hartschaum (Rohdichte 15 kg/m³)', uuid: '205b761d-e344-49c3-a3a9-bb1bfd59b916', version: '00.02.000', typ: 'Durchschnitt (IVH, EPD)', gruppe: '2.2.01 Dämmstoffe / EPS weiß', einheit: 'm³', kennwert: 15, kennwertEinheit: 'kg/m³', a1a3: 46.99, c3: 50.4, c4: 0, gueltigBis: 2027, hinweis: 'C3 = thermische Verwertung' },
    HF: { name: 'Holzfaserdämmstoffplatte Trockenverfahren (Durchschnitt DE)', uuid: '5488d3f3-1e39-4a71-b357-ef605b65ed9c', version: '00.00.062', typ: 'repräsentativ (Thünen)', gruppe: '2.10.01 Dämmstoffe / Holzfaserdämmplatte', einheit: 'm³', kennwert: 162.34, kennwertEinheit: 'kg/m³', a1a3: -174.78, c3: 258.35, c4: null, gueltigBis: 2028, hinweis: 'A1–A3 negativ (biogener Kohlenstoff), Ausbuchung in C3; C4 nicht deklariert' },
    ARMP: { name: 'Putzmörtel-Armierungsputz', uuid: 'ddecdeb4-35f8-48ee-b52b-22b5de4b6e82', version: '00.01.000', typ: 'Muster-EPD (VDPM)', gruppe: '1.4.04 Mineralische Baustoffe / Putz und Putzmörtel', einheit: 'kg', kennwert: 1600, kennwertEinheit: 'kg/m³', a1a3: 0.406, c3: 0, c4: 0.0163, gueltigBis: 2029, hinweis: 'EPD umfasst Klebe- und Armierungsmörtel; für Kleber und Armierungsschicht verwendet' },
    NORMP: { name: 'Putzmörtel-Normalputz/Edelputz mit besonderen Eigenschaften', uuid: '0144d30d-e4d7-4c05-a4c5-282772589893', version: '00.01.000', typ: 'Muster-EPD (VDPM)', gruppe: '1.4.04 Mineralische Baustoffe / Putz und Putzmörtel', einheit: 'kg', kennwert: 1550, kennwertEinheit: 'kg/m³', a1a3: 0.335, c3: 0, c4: 0.0154, gueltigBis: 2029, hinweis: 'mineralischer Oberputz (Edelputz)' },
    DISP: { name: 'Dispersionsputz', uuid: '44eada3f-2004-48b9-8152-22cd045bc3cf', version: '20.26.070', typ: 'generisch (Sphera)', gruppe: '5.1.01 Beschichtungen / Grundierungen Farben und Putze', einheit: 'kg', kennwert: null, kennwertEinheit: '', a1a3: 0.86459, c3: null, c4: 0.029828, gueltigBis: 2026, proxy: true, hinweis: 'PROXY für Silikatputz: kein eigenständiger Silikatputz-Datensatz in 2024-II' },
    GEW: { name: 'Glasarmierungsgitter', uuid: 'b3bb06b1-fefb-4e57-99ee-aa113000343b', version: '20.26.070', typ: 'generisch (Sphera)', gruppe: '1.3.16 Mineralische Baustoffe / Steine und Elemente', einheit: 'm²', kennwert: 0.16, kennwertEinheit: 'kg/m²', a1a3: 0.7207, c3: null, c4: 0.0034552, gueltigBis: 2026, hinweis: 'Armierungsgewebe 160 g/m²' },
    NYLON: { name: 'Nylon Gussteil (PA 6.6)', uuid: 'cedc1a00-0e33-4b63-bf1c-c415241504ea', version: '20.26.070', typ: 'generisch (Sphera)', gruppe: '6.4.01 Kunststoffe / Kunststoffprofile hart', einheit: 'kg', kennwert: null, kennwertEinheit: '', a1a3: 11.03, c3: 2.8751, c4: null, gueltigBis: 2026, proxy: true, hinweis: 'PROXY für WDVS-Dübel: kein Dübel-Datensatz in 2024-II' },
    KVH: { name: 'Konstruktionsvollholz (Durchschnitt DE)', uuid: '7aba3603-0689-4da5-8d24-fd92ae398d07', version: '00.00.032', typ: 'repräsentativ (Thünen)', gruppe: '3.1.02 Holz / Konstruktionsvollholz', einheit: 'm³', kennwert: 492.92, kennwertEinheit: 'kg/m³', a1a3: -726.98, c3: 815.98, c4: null, gueltigBis: 2028, hinweis: 'A1–A3 negativ (biogener Kohlenstoff), Ausbuchung in C3' },
    ALUP: { name: 'Aluminium Profil', uuid: '3feca796-791b-46d3-8160-95ef243ffb9d', version: '20.26.070', typ: 'generisch (Sphera)', gruppe: '4.3.02 Metalle / Aluminiumprofil', einheit: 'kg', kennwert: 2700, kennwertEinheit: 'kg/m³', a1a3: 10.897, c3: 0, c4: null, gueltigBis: 2026, hinweis: 'Recyclinggutschrift liegt in Modul D (hier nicht bilanziert)' },
    USB: { name: 'Unterspannbahn PP', uuid: 'b4634111-dc95-4873-8614-9ab38bd11d42', version: '20.26.070', typ: 'generisch (Sphera)', gruppe: '6.6.01 Kunststoffe / Unterspannbahn', einheit: 'm²', kennwert: 0.15, kennwertEinheit: 'kg/m²', a1a3: 0.44943, c3: 0.33336, c4: null, gueltigBis: 2026, hinweis: 'als Winddichtung / Fassadenbahn' },
    SCHR: { name: 'Befestigungsmittel/Schrauben Edelstahl', uuid: '6c46fc8d-6a74-415b-8e6b-b90af72178ac', version: '20.26.070', typ: 'generisch (Sphera)', gruppe: '7.4.06 Beschläge / Befestigungen', einheit: 'kg', kennwert: 7850, kennwertEinheit: 'kg/m³', a1a3: 4.1835, c3: null, c4: null, gueltigBis: 2026, hinweis: 'C3/C4 nicht deklariert' },
    LAER: { name: 'Schnittholz Lärche (generisch, 12% Feuchte/10,7% H2O)', uuid: '9f6cf0e4-7455-4c31-a99f-552926c4040e', version: '20.26.070', typ: 'generisch (Sphera)', gruppe: '3.1.01 Holz / Bau-Schnittholz', einheit: 'm³', kennwert: 660.8, kennwertEinheit: 'kg/m³', a1a3: -896.18, c3: 1099.8, c4: null, gueltigBis: 2026, hinweis: 'Holzbekleidung; A1–A3 negativ (biogener Kohlenstoff)' },
    ALUB: { name: 'Aluminiumblech', uuid: '143a4df2-563e-4ef9-b75b-90e1cf9f7ef9', version: '20.26.070', typ: 'generisch (Sphera)', gruppe: '4.3.01 Metalle / Aluminiumbleche', einheit: 'kg', kennwert: 2700, kennwertEinheit: 'kg/m³', a1a3: 10.771, c3: 0, c4: null, gueltigBis: 2026, hinweis: 'Metallbekleidung; Recyclinggutschrift in Modul D' },
    HBR: { name: 'Holz-Blendrahmen', uuid: '530ff9e2-0189-4783-9546-3bb8f64fbbeb', version: '20.26.070', typ: 'generisch (Sphera)', gruppe: '7.1.01 Rahmen / Profile / Holz', einheit: 'm', kennwert: 2.11, kennwertEinheit: 'kg/m', a1a3: -0.48211, c3: 3.9754, c4: null, gueltigBis: 2026, hinweis: '' },
    HFR: { name: 'Holz-Flügelrahmen', uuid: 'b0c75d7b-4cce-41cf-b785-1db434ee9c3f', version: '20.26.070', typ: 'generisch (Sphera)', gruppe: '7.1.01 Rahmen / Profile / Holz', einheit: 'm', kennwert: 2.11, kennwertEinheit: 'kg/m', a1a3: -0.17732, c3: 3.9877, c4: null, gueltigBis: 2026, hinweis: '' },
    ABR: { name: 'Aluminium-Rahmenprofil, thermisch getrennt, pulverbeschichtet', uuid: 'c104fddf-7504-4b2a-9b9f-a706191ee5aa', version: '20.26.070', typ: 'generisch (Sphera)', gruppe: '7.1.06 Rahmen / Profile / Aluminium thermisch getrennt', einheit: 'm', kennwert: 1.43, kennwertEinheit: 'kg/m', a1a3: 16.171, c3: 0.69314, c4: null, gueltigBis: 2026, hinweis: '' },
    AFR: { name: 'Aluminium-Flügelrahmenprofil, thermisch getrennt, pulverbeschichtet', uuid: '4b3adfcf-18b6-43fd-ad5b-ff9781bc081f', version: '20.26.070', typ: 'generisch (Sphera)', gruppe: '7.1.06 Rahmen / Profile / Aluminium thermisch getrennt', einheit: 'm', kennwert: 1.51, kennwertEinheit: 'kg/m', a1a3: 17.446, c3: 0.58772, c4: null, gueltigBis: 2026, hinweis: '' },
    PBR: { name: 'Blendrahmen PVC-U', uuid: 'd8aa07b1-b3aa-41b0-a17b-f8f5e15f37f3', version: '20.26.070', typ: 'generisch (Sphera)', gruppe: '7.1.09 Rahmen / Profile / PVC', einheit: 'm', kennwert: 2.8, kennwertEinheit: 'kg/m', a1a3: 8.2495, c3: 2.9296, c4: null, gueltigBis: 2026, hinweis: '' },
    PFR: { name: 'Flügelrahmen PVC-U', uuid: '73de9e80-8ed2-47d8-b5b6-854c84166f24', version: '20.26.070', typ: 'generisch (Sphera)', gruppe: '7.1.09 Rahmen / Profile / PVC', einheit: 'm', kennwert: 3.1, kennwertEinheit: 'kg/m', a1a3: 9.2322, c3: 3.6056, c4: null, gueltigBis: 2026, hinweis: '' },
    G2: { name: 'Isolierglas 2-Scheiben', uuid: 'd7bf4202-d1a8-4f3e-8861-c3d78cd2bf70', version: '20.26.070', typ: 'generisch (Sphera)', gruppe: '7.2.01 Füllungen / Transparente Füllungen', einheit: 'm²', kennwert: 20.5, kennwertEinheit: 'kg/m²', a1a3: 38.28, c3: 1.5152, c4: 0.36243, gueltigBis: 2026, hinweis: '' },
    G3: { name: 'Dreifachverglasung', uuid: 'ba58d8b9-945b-4428-b4e0-aecda8b3df18', version: '20.26.070', typ: 'generisch (Sphera)', gruppe: '7.2.01 Füllungen / Transparente Füllungen', einheit: 'm²', kennwert: 30, kennwertEinheit: 'kg/m²', a1a3: 59.765, c3: 3.0303, c4: 0.54364, gueltigBis: 2026, hinweis: '' },
    BES: { name: 'Fenster-Beschlag für Drehkippfenster (Aluminium)', uuid: 'b30999ac-b5a1-4ccd-bfcf-b9310b458db6', version: '20.26.070', typ: 'generisch (Sphera)', gruppe: '7.4.02 Beschläge / Aluminiumbeschläge', einheit: 'Stk', kennwert: 1.647, kennwertEinheit: 'kg/Stk', a1a3: 13.393, c3: 0, c4: null, gueltigBis: 2026, hinweis: '' },
  };
  Object.entries(DATENSAETZE).forEach(([id, d]) => { d.id = id; d.link = L(d.uuid, d.version); });

  /**
   * Schichten je System. `wahl` = zu welcher Auswahl die Schicht gehört ('FIX' = immer dabei).
   * Mengenart (Umrechnung auf 1 m² Wand bzw. 1 m² Fenster, vor Verschnitt):
   *   'volumen'  m³ = 1 m² · d                 (Datensatz in m³)
   *   'masse'    kg = 1 m² · d · ρ             (ρ = Kennwert des Datensatzes)
   *   'direkt'   Menge je m² direkt angegeben  (z. B. Verbrauch kg/m², Querschnitt m³/m²)
   *   'flaeche'  m² = 1 m²
   *   'blendrahmen' / 'fluegelrahmen'  m Rahmen je m² Fenster (aus Fenstergeometrie)
   *   'glas'     m² Glas je m² Fenster = 1 − Rahmenanteil
   *   'beschlag' Stück je m² Fenster = Anzahl Fenster / Fensterfläche
   * daemmung: true -> Dicke kommt aus der U-Wert-Berechnung (Modul Sanierung, gleiches U nach GModG).
   * rsl = Nutzungsdauer in Jahren (Annahme in Anlehnung an BBSR-Tabelle, bitte prüfen).
   */
  const S = (o) => o;
  const SCHICHTEN = {
    wdvs: [
      S({ code: 'W-KLEB', name: 'Klebemörtel', wahl: 'FIX', ds: 'ARMP', art: 'direkt', menge: 4.5, verschnitt: 0.05, rsl: 40, hinweis: 'Annahme: 4,5 kg/m² Klebemörtel (üblich 4–5 kg/m², Randwulst-Punkt-Verfahren)' }),
      S({ code: 'W-D-MW', name: 'Dämmung: Mineralwolle', wahl: 'mw', ds: 'MW_WDVS', art: 'volumen', d: 0.16, daemmung: true, verschnitt: 0.03, rsl: 40, hinweis: 'Dicke aus U-Wert-Berechnung (Startwert Excel 160 mm)' }),
      S({ code: 'W-D-EPS', name: 'Dämmung: EPS', wahl: 'eps', ds: 'EPS15', art: 'volumen', d: 0.16, daemmung: true, verschnitt: 0.03, rsl: 40, hinweis: 'Dicke aus U-Wert-Berechnung (Startwert Excel 160 mm)' }),
      S({ code: 'W-D-HF', name: 'Dämmung: Holzfaser', wahl: 'holzfaser', ds: 'HF', art: 'volumen', d: 0.18, daemmung: true, verschnitt: 0.03, rsl: 40, hinweis: 'Dicke aus U-Wert-Berechnung (Startwert Excel 180 mm)' }),
      S({ code: 'W-DUEB', name: 'Dübel', wahl: 'FIX', ds: 'NYLON', art: 'direkt', menge: 0.12, verschnitt: 0, rsl: 40, hinweis: 'Annahme: 6 Dübel/m² · 0,02 kg/Stk; Datensatz ist Proxy (PA 6.6)' }),
      S({ code: 'W-ARM', name: 'Armierungsmörtel (Unterputz)', wahl: 'FIX', ds: 'ARMP', art: 'masse', d: 0.004, verschnitt: 0.05, rsl: 40, hinweis: 'Annahme: 4 mm Armierungsschicht' }),
      S({ code: 'W-GEW', name: 'Armierungsgewebe', wahl: 'FIX', ds: 'GEW', art: 'flaeche', verschnitt: 0.10, rsl: 40, hinweis: 'Annahme: 10 % Überlappung als Zuschlag' }),
      S({ code: 'W-P-MIN', name: 'Oberputz: mineralischer Putz', wahl: 'mineralisch', ds: 'NORMP', art: 'masse', d: 0.003, verschnitt: 0.05, rsl: 40, hinweis: 'Annahme: 3 mm Oberputz (Kornstärke)' }),
      S({ code: 'W-P-SIL', name: 'Oberputz: Silikatputz', wahl: 'silikat', ds: 'DISP', art: 'direkt', menge: 3.0, d: 0.002, verschnitt: 0.05, rsl: 40, hinweis: 'Annahme: 3,0 kg/m² (pastöser Putz, 2 mm Korn); Datensatz ist Proxy (Dispersionsputz)' }),
    ],
    vhf: [
      S({ code: 'V-D-MW', name: 'Dämmung: Mineralwolle', wahl: 'mw', ds: 'MW_VHF', art: 'volumen', d: 0.16, daemmung: true, verschnitt: 0.03, rsl: 50, hinweis: 'Dicke aus U-Wert-Berechnung (Startwert Excel 160 mm)' }),
      S({ code: 'V-D-EPS', name: 'Dämmung: EPS', wahl: 'eps', ds: 'EPS15', art: 'volumen', d: 0.16, daemmung: true, verschnitt: 0.03, rsl: 50, hinweis: 'Dicke aus U-Wert-Berechnung; EPS in VHF brandschutztechnisch prüfen' }),
      S({ code: 'V-D-HF', name: 'Dämmung: Holzfaser', wahl: 'holzfaser', ds: 'HF', art: 'volumen', d: 0.18, daemmung: true, verschnitt: 0.03, rsl: 50, hinweis: 'Dicke aus U-Wert-Berechnung (Startwert Excel 180 mm)' }),
      S({ code: 'V-UK-HOLZ', name: 'Unterkonstruktion: Holz', wahl: 'uk-holz', ds: 'KVH', art: 'direkt', menge: 0.0115, verschnitt: 0.05, rsl: 50, hinweis: 'Annahme: Grundlattung 60×80 mm + Traglattung 40×60 mm, e = 62,5 cm → 0,0115 m³/m²' }),
      S({ code: 'V-UK-ALU', name: 'Unterkonstruktion: Aluminium', wahl: 'uk-alu', ds: 'ALUP', art: 'direkt', menge: 2.0, verschnitt: 0.05, rsl: 50, hinweis: 'Annahme: 2,0 kg/m² Wandhalter + Tragprofile (üblich 1,5–2,5 kg/m²)' }),
      S({ code: 'V-WIND', name: 'Winddichtung (Fassadenbahn)', wahl: 'FIX', ds: 'USB', art: 'flaeche', verschnitt: 0.10, rsl: 50, hinweis: 'Annahme: 10 % Überlappung als Zuschlag' }),
      S({ code: 'V-BEF', name: 'Befestigung (Schrauben)', wahl: 'FIX', ds: 'SCHR', art: 'direkt', menge: 0.15, verschnitt: 0, rsl: 50, hinweis: 'Annahme: 0,15 kg/m² Edelstahlschrauben' }),
      S({ code: 'V-B-HOLZ', name: 'Bekleidung: Holz (Lärche)', wahl: 'b-holz', ds: 'LAER', art: 'volumen', d: 0.024, verschnitt: 0.10, rsl: 40, hinweis: 'Annahme: 24 mm Schalung, 10 % Verschnitt' }),
      S({ code: 'V-B-ALU', name: 'Bekleidung: Metall (Aluminiumblech)', wahl: 'b-alu', ds: 'ALUB', art: 'masse', d: 0.002, verschnitt: 0.05, rsl: 50, hinweis: 'Annahme: 2 mm Aluminiumblech' }),
    ],
    fenster: [
      S({ code: 'F-R-HOLZ-B', name: 'Rahmen Holz: Blendrahmen', wahl: 'holz', ds: 'HBR', art: 'blendrahmen', verschnitt: 0, rsl: 40, hinweis: 'Rahmenlänge aus Fenstergeometrie' }),
      S({ code: 'F-R-HOLZ-F', name: 'Rahmen Holz: Flügelrahmen', wahl: 'holz', ds: 'HFR', art: 'fluegelrahmen', verschnitt: 0, rsl: 40, hinweis: 'Rahmenlänge aus Fenstergeometrie' }),
      S({ code: 'F-R-ALU-B', name: 'Rahmen Alu: Blendrahmen', wahl: 'alu', ds: 'ABR', art: 'blendrahmen', verschnitt: 0, rsl: 50, hinweis: 'Rahmenlänge aus Fenstergeometrie' }),
      S({ code: 'F-R-ALU-F', name: 'Rahmen Alu: Flügelrahmen', wahl: 'alu', ds: 'AFR', art: 'fluegelrahmen', verschnitt: 0, rsl: 50, hinweis: 'Rahmenlänge aus Fenstergeometrie' }),
      S({ code: 'F-R-PVC-B', name: 'Rahmen PVC: Blendrahmen', wahl: 'pvc', ds: 'PBR', art: 'blendrahmen', verschnitt: 0, rsl: 40, hinweis: 'Rahmenlänge aus Fenstergeometrie' }),
      S({ code: 'F-R-PVC-F', name: 'Rahmen PVC: Flügelrahmen', wahl: 'pvc', ds: 'PFR', art: 'fluegelrahmen', verschnitt: 0, rsl: 40, hinweis: 'Rahmenlänge aus Fenstergeometrie' }),
      S({ code: 'F-G-2', name: 'Verglasung: 2-fach', wahl: 'zweifach', ds: 'G2', art: 'glas', verschnitt: 0, rsl: 30, hinweis: 'Glasanteil = 1 − Rahmenanteil' }),
      S({ code: 'F-G-3', name: 'Verglasung: 3-fach', wahl: 'dreifach', ds: 'G3', art: 'glas', verschnitt: 0, rsl: 30, hinweis: 'Glasanteil = 1 − Rahmenanteil' }),
      S({ code: 'F-BES', name: 'Beschlag', wahl: 'FIX', ds: 'BES', art: 'beschlag', verschnitt: 0, rsl: 30, hinweis: '1 Drehkipp-Beschlag je Fenster' }),
    ],
  };

  /**
   * Auswahlmöglichkeiten mit Vor- und Nachteilen.
   * quelle 'folie' = aus den Projektfolien (Fassadensysteme / Dämmstoffe); 'entwurf' = Textvorschlag, fachlich prüfen.
   */
  const OPTIONEN = {
    system: {
      wdvs: { name: 'WDVS', lang: 'Wärmedämmverbundsystem', quelle: 'folie',
        vorteile: ['Direkt verklebte Dämmung', 'Guter Wärmeschutz', 'Standardlösung bei Putzfassaden', 'Günstiger', 'Geringerer Aufwand'],
        nachteile: ['Empfindlich gegenüber Feuchtigkeit und Beschädigungen', 'Eingeschränkte Rückbaubarkeit'] },
      vhf: { name: 'VHF', lang: 'Vorgehängte hinterlüftete Fassade', quelle: 'folie',
        vorteile: ['Hinterlüfteter Aufbau (Luftspalt zwischen Dämmung und Bekleidung)', 'Sehr guter Feuchteschutz', 'Gute Rückbaubarkeit', 'Hohe Dauerhaftigkeit'],
        nachteile: ['Höhere Kosten und Aufwand', 'Größere Konstruktionsdicke und Gewicht'] },
    },
    daemmstoff: {
      eps: { name: 'EPS', lang: 'EPS · Polystyrol', quelle: 'folie',
        vorteile: ['Kostengünstig und leicht', 'Einfache Verarbeitung'],
        nachteile: ['Brennbar; Systemaufbau beachten', 'Begrenzte Kreislauffähigkeit', 'Sommerlicher Wärmeschutz geringer als bei schweren Dämmstoffen'] },
      mw: { name: 'Mineralwolle', lang: 'Mineralwolle', quelle: 'folie',
        vorteile: ['Nichtbrennbar (A1, Produkt/System prüfen)', 'Guter Schallschutz', 'Diffusionsoffen'],
        nachteile: ['Höheres Gewicht', 'Herstellung mit höherem Energieaufwand möglich'] },
      holzfaser: { name: 'Holzfaser', lang: 'Holzfaser', quelle: 'folie',
        vorteile: ['Guter sommerlicher Wärmeschutz', 'Nachwachsender Rohstoff', 'Biogener Kohlenstoff im Material gebunden'],
        nachteile: ['Produktabhängige Ökobilanz', 'Häufig höhere Kosten und höheres Gewicht', 'Höhere Wärmeleitfähigkeit (λ ≈ 0,040) → dickere Dämmung'] },
    },
    putz: {
      mineralisch: { name: 'mineralischer Putz', quelle: 'entwurf',
        vorteile: ['Nichtbrennbar', 'Diffusionsoffen', 'Niedriges GWP je m²'],
        nachteile: ['Weniger elastisch, eher rissanfällig'] },
      silikat: { name: 'Silikatputz', quelle: 'entwurf',
        vorteile: ['Diffusionsoffen', 'Alkalisch → geringe Neigung zu Algen- und Pilzbefall'],
        nachteile: ['Kein eigener ÖKOBAUDAT-Datensatz (Proxy Dispersionsputz) → GWP unsicher'] },
    },
    uk: {
      holz: { name: 'Holz-UK', lang: 'Holz-Unterkonstruktion', quelle: 'entwurf',
        vorteile: ['Nachwachsender Rohstoff, sehr niedriges GWP', 'Geringe Wärmebrücken (ΔU 0,02)'],
        nachteile: ['Brennbar – in höheren Gebäudeklassen eingeschränkt', 'Feuchteempfindlich'] },
      alu: { name: 'Alu-UK', lang: 'Aluminium-Unterkonstruktion', quelle: 'entwurf',
        vorteile: ['Nichtbrennbar', 'Maßhaltig, auch für große Dämmdicken'],
        nachteile: ['Hohes GWP in der Herstellung', 'Größere Wärmebrücken (ΔU 0,04) → dickere Dämmung'] },
    },
    bekleidung: {
      holz: { name: 'Holzbekleidung', lang: 'Holzbekleidung (Lärche)', quelle: 'entwurf',
        vorteile: ['Nachwachsender Rohstoff, biogener Kohlenstoff gebunden', 'Niedriges GWP'],
        nachteile: ['Kürzere Nutzungsdauer (Austausch nach 40 a in der Rechnung)', 'Vergrauung, Pflegeaufwand', 'Brennbar'] },
      alu: { name: 'Metallbekleidung', lang: 'Metallbekleidung (Aluminiumblech)', quelle: 'entwurf',
        vorteile: ['Langlebig und wartungsarm', 'Gut recycelbar (Gutschrift Modul D hier nicht bilanziert)'],
        nachteile: ['Sehr hohes GWP in der Herstellung'] },
    },
    rahmen: {
      holz: { name: 'Holz', quelle: 'entwurf', vorteile: ['Niedriges GWP, nachwachsender Rohstoff'], nachteile: ['Pflegeaufwand (Anstrich)'] },
      alu: { name: 'Aluminium', quelle: 'entwurf', vorteile: ['Langlebig, wartungsarm, schlanke Profile'], nachteile: ['Hohes GWP in der Herstellung'] },
      pvc: { name: 'PVC', quelle: 'entwurf', vorteile: ['Günstig und pflegeleicht'], nachteile: ['Fossiler Rohstoff, höheres GWP als Holz'] },
    },
    verglasung: {
      zweifach: { name: '2-fach', quelle: 'entwurf', vorteile: ['Geringeres GWP und Gewicht'], nachteile: ['Schlechterer Wärmeschutz – Uw ≤ 1,3 (GModG) evtl. nicht erfüllt'] },
      dreifach: { name: '3-fach', quelle: 'entwurf', vorteile: ['Sehr guter Wärmeschutz'], nachteile: ['Höheres GWP und Gewicht'] },
    },
  };

  const api = { QUELLE, ZEITRAEUME, FENSTER_STANDARD, DATENSAETZE, SCHICHTEN, OPTIONEN };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.LcaDaten = api;
})(typeof self !== 'undefined' ? self : this);
