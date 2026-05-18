-- ============================================================
-- SEED : ECAM CONGO  (tenant c9651476-2fc4-407a-8a4e-778fa1332689)
-- Exécuter dans Supabase → SQL Editor
-- ============================================================

-- 1. Appliquer migration 036 (idempotent — sans danger si déjà faite)
ALTER TABLE enseignants
  ADD COLUMN IF NOT EXISTS photo_url           TEXT    DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS salaire_mensuel     INTEGER DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS taux_horaire        INTEGER DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS mobile_money_type   TEXT    DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS mobile_money_numero TEXT    DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS banque              TEXT    DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS rib                 TEXT    DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS numero_cnss         TEXT    DEFAULT NULL;

-- 2. Données fictives
DO $$
DECLARE
  tid UUID := 'c9651476-2fc4-407a-8a4e-778fa1332689';
BEGIN

  -- Nettoyage des données existantes pour ce tenant
  DELETE FROM employes    WHERE tenant_id = tid;
  DELETE FROM staff_ecole WHERE tenant_id = tid;
  DELETE FROM etudiants   WHERE tenant_id = tid;
  DELETE FROM enseignants WHERE tenant_id = tid;

  -- ── Enseignants ────────────────────────────────────────────
  INSERT INTO enseignants
    (tenant_id, nom, prenom, matiere, telephone, email, statut,
     salaire_mensuel, taux_horaire, banque, rib, numero_cnss)
  VALUES
    (tid, 'MBUMBA',   'Claude',      'Mathématiques',       '+243812345001', 'c.mbumba@ecamcongo.cd',   'actif',  850000, 25000, 'Rawbank',     'CD01234567890', 'CNSS-ENS-001'),
    (tid, 'LUKOKI',   'Marie-Claire','Physique-Chimie',      '+243812345002', 'm.lukoki@ecamcongo.cd',   'actif',  780000, 22000, 'Equity BCDC', 'CD09876543210', 'CNSS-ENS-002'),
    (tid, 'NGOMA',    'Serge',       'Informatique',         '+243812345003', 's.ngoma@ecamcongo.cd',    'actif',  920000, 28000, 'TMB',         'CD11223344550', 'CNSS-ENS-003'),
    (tid, 'KIMPIATU', 'Alphonse',    'Histoire-Géographie',  '+243812345004', 'a.kimpiatu@ecamcongo.cd', 'conge',  720000, NULL,  'Rawbank',     'CD55667788990', 'CNSS-ENS-004'),
    (tid, 'BONGOLO',  'Esther',      'Français-Littérature', '+243812345005', 'e.bongolo@ecamcongo.cd',  'actif',  800000, 24000, NULL,          NULL,            'CNSS-ENS-005'),
    (tid, 'TSHILOMBO','Pascal',      'Biologie',             '+243812345006', 'p.tshilombo@ecamcongo.cd','actif',  870000, 26000, 'Rawbank',     'CD66778899001', 'CNSS-ENS-006'),
    (tid, 'MALONGA',  'Céleste',     'Anglais',              '+243812345007', 'c.malonga@ecamcongo.cd',  'inactif',690000, NULL,  'TMB',         'CD77889900112', 'CNSS-ENS-007');

  -- ── Étudiants ─────────────────────────────────────────────
  INSERT INTO etudiants
    (tenant_id, numero_id, nom, prenom, date_naissance, lieu_naissance,
     nationalite, adresse, niveau, classe, statut,
     nom_pere, nom_mere, tel_parent, email_parent,
     annee_scolaire, code_deblocage)
  VALUES
    (tid,'ECAM-2025-001','KALALA',    'Jonathan','2006-03-15','Kinshasa',    'Congolaise','Av. Kasa-Vubu, Kinshasa',    'terminale','T3-Sciences','actif',   'KALALA Willy',   'KALALA Yvette', '+243823456001','kalala.parent@gmail.com','2024-2025','DEB2025001'),
    (tid,'ECAM-2025-002','NSIMBA',    'Grace',   '2007-07-22','Brazzaville', 'Congolaise','Av. 24 Novembre, Kinshasa',  '4eme',     'Q4-B',      'actif',   'NSIMBA Joseph',  'NSIMBA Marie',  '+243823456002','nsimba.parent@gmail.com','2024-2025','DEB2025002'),
    (tid,'ECAM-2025-003','MWAMBA',    'Christophe','2005-11-08','Lubumbashi','Congolaise','Av. des Cliniques, Kinshasa', 'terminale','T1-Lettres', 'actif',   'MWAMBA Pierre',  'MWAMBA Joëlle', '+243823456003','mwamba.parent@gmail.com','2024-2025','DEB2025003'),
    (tid,'ECAM-2025-004','TSHIAMA',   'Prisca',  '2008-02-14','Kinshasa',    'Congolaise','Av. Colonel Mondjiba, Kin',  '3eme',     'Q3-A',      'actif',   'TSHIAMA Robert', 'TSHIAMA Céline','+243823456004','tshiama.parent@gmail.com','2024-2025','DEB2025004'),
    (tid,'ECAM-2025-005','KABENGELE', 'David',   '2006-09-30','Mbuji-Mayi',  'Congolaise','Av. Kimbanguiste, Kinshasa', 'terminale','T2-Sciences','suspendu','KABENGELE André','KABENGELE Lise','+243823456005','kabeng.parent@gmail.com', '2024-2025','DEB2025005'),
    (tid,'ECAM-2025-006','LUZOLO',    'Chancelle','2007-05-18','Kinshasa',   'Congolaise','Av. de la Justice, Kinshasa','4eme',     'Q4-A',      'actif',   'LUZOLO Théodore','LUZOLO Thérèse','+243823456006','luzolo.parent@gmail.com','2024-2025','DEB2025006'),
    (tid,'ECAM-2025-007','KIBANGU',   'Micheline','2008-12-01','Kinshasa',   'Congolaise','Av. Victoire, Kinshasa',     '3eme',     'Q3-B',      'actif',   'KIBANGU Henri',  'KIBANGU Fabiola','+243823456007','kibangu.parent@gmail.com','2024-2025','DEB2025007'),
    (tid,'ECAM-2025-008','NZINGA',    'Erick',   '2005-06-25','Kinshasa',   'Congolaise','Av. Kalemie, Kinshasa',      'terminale','T3-Lettres', 'actif',   'NZINGA Sylvain', 'NZINGA Angèle', '+243823456008','nzinga.parent@gmail.com','2024-2025','DEB2025008');

  -- ── Staff École ────────────────────────────────────────────
  INSERT INTO staff_ecole
    (tenant_id, nom, prenom, poste, telephone, email, salaire, statut, banque, rib, numero_cnss)
  VALUES
    (tid,'MABIKA',  'Théodore','Directeur Général',      '+243831000001','t.mabika@ecamcongo.cd',   2500000,'actif','Rawbank',     'CD99887766550','CNSS-ST-001'),
    (tid,'YALA',    'Sandrine','Secrétaire de Direction', '+243831000002','s.yala@ecamcongo.cd',     1200000,'actif','Equity BCDC', 'CD88776655440','CNSS-ST-002'),
    (tid,'MAKIESE', 'Gabriel', 'Comptable',               '+243831000003','g.makiese@ecamcongo.cd',  1500000,'actif','TMB',         'CD77665544330','CNSS-ST-003'),
    (tid,'NSONI',   'Félicité','Agent d''entretien',      '+243831000004',NULL,                       450000,'actif', NULL,          NULL,           'CNSS-ST-004'),
    (tid,'BWANGA',  'Justin',  'Gardien de sécurité',     '+243831000005',NULL,                       380000,'actif', NULL,          NULL,           'CNSS-ST-005');

  -- ── Employés (table RH) ────────────────────────────────────
  INSERT INTO employes
    (tenant_id, nom, postnom, prenom, sexe, date_naissance, nationalite,
     telephone, email_pro, adresse, ville, pays,
     poste, departement, type_employe, statut, date_recrutement,
     salaire_base, prime_logement, prime_transport, prime_risque, prime_rendement,
     mode_paiement, banque, rib, numero_cnss, numero_fiscal)
  VALUES
    (tid,'MABIALA','ADJI',   'Gordon',   'M','1985-04-10','Congolaise','+243840000001','g.mabiala@ecamcongo.cd',   'Av. Victoire 12, Kin',    'Kinshasa','RDC',
     'Directeur Pédagogique','Direction','permanent','actif','2020-01-15',
     3000000,500000,200000,150000,300000,'banque','Rawbank','CD12345678901','CNSS-EMP-001','NIF-2020-001'),
    (tid,'NKOSI',  'BULA',   'Christine','F','1990-08-22','Congolaise','+243840000002','c.nkosi@ecamcongo.cd',    'Av. OUA 45, Kin',         'Kinshasa','RDC',
     'Responsable RH','Ressources Humaines','permanent','actif','2021-03-01',
     2200000,400000,200000,0,250000,'banque','Equity BCDC','CD23456789012','CNSS-EMP-002','NIF-2021-002'),
    (tid,'MBUTA',  NULL,     'Patrice',  'M','1993-12-05','Congolaise','+243840000003','p.mbuta@ecamcongo.cd',    'Av. Matadi 7, Kin',       'Kinshasa','RDC',
     'Technicien Informatique','IT','permanent','actif','2022-06-10',
     1800000,300000,200000,100000,200000,'mobile_money',NULL,NULL,'CNSS-EMP-003','NIF-2022-003'),
    (tid,'KIMBA',  'LELO',   'Astrid',   'F','1995-07-17','Congolaise','+243840000004','a.kimba@ecamcongo.cd',    'Av. de la Paix 33, Kin',  'Kinshasa','RDC',
     'Surveillant Général','Sécurité','contractuel','actif','2023-09-01',
     1100000,200000,150000,50000,100000,'mobile_money',NULL,NULL,'CNSS-EMP-004','NIF-2023-004'),
    (tid,'LUKUSA', 'MWANA',  'Félicien', 'M','1988-02-28','Congolaise','+243840000005','f.lukusa@ecamcongo.cd',   'Av. Kasavubu 19, Kin',    'Kinshasa','RDC',
     'Professeur de Maths','Pédagogie','formateur','actif','2019-09-02',
     2000000,350000,200000,0,150000,'banque','TMB','CD34567890123','CNSS-EMP-005','NIF-2019-005');

END $$;

-- Vérification rapide
SELECT 'enseignants' AS table_name, count(*) FROM enseignants WHERE tenant_id = 'c9651476-2fc4-407a-8a4e-778fa1332689'
UNION ALL
SELECT 'etudiants',  count(*) FROM etudiants  WHERE tenant_id = 'c9651476-2fc4-407a-8a4e-778fa1332689'
UNION ALL
SELECT 'staff_ecole',count(*) FROM staff_ecole WHERE tenant_id = 'c9651476-2fc4-407a-8a4e-778fa1332689'
UNION ALL
SELECT 'employes',   count(*) FROM employes   WHERE tenant_id = 'c9651476-2fc4-407a-8a4e-778fa1332689';
