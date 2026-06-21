/* Rounds — Anatomy: the skeleton */

/* ---------- bone metadata (fallback; data/bones.json enriches the 62 named bones) ---------- */
const BONE_META = {
  // overview targets (skeleton view only)
  skull: { name: 'Skull', latin: 'Cranium', paired: false, blurb: 'The bony framework of the head — 22 bones (8 cranial + 14 facial) enclosing the brain and face.', pearl: 'Click into the Skull region to label all 22 bones individually.', region: 'overview' },
  'vertebral-column': { name: 'Vertebral column', latin: 'Columna vertebralis', paired: false, blurb: '33 vertebrae in 5 regions (cervical, thoracic, lumbar, sacral, coccygeal) forming the central axis.', pearl: 'Open the Spine region to drill into each segment.', region: 'overview' },
  sternum: { name: 'Sternum', latin: 'Sternum', paired: false, blurb: 'Flat breastbone of the anterior chest: manubrium, body, and xiphoid process.', pearl: 'The sternal angle (of Louis) marks rib 2 and the T4/T5 disc.', region: 'overview' },
  ribs: { name: 'Ribs', latin: 'Costae', paired: true, blurb: '12 pairs of curved flat bones forming the thoracic cage and protecting the heart and lungs.', pearl: 'Open the Thorax region to split true / false / floating ribs.', region: 'overview' },
  'hip-bone': { name: 'Hip bone (os coxae)', latin: 'Os coxae', paired: true, blurb: 'Each hip bone fuses three bones — ilium, ischium, pubis — meeting at the acetabulum.', pearl: 'The three parts fuse at the triradiate cartilage of the acetabulum by the late teens.', region: 'overview' },
  hand: { name: 'Hand & wrist', latin: 'Manus', paired: true, blurb: '27 bones: 8 carpals, 5 metacarpals, 14 phalanges.', pearl: 'Open the Hand region to label every carpal individually.', region: 'overview' },
  foot: { name: 'Foot & ankle', latin: 'Pes', paired: true, blurb: '26 bones: 7 tarsals, 5 metatarsals, 14 phalanges.', pearl: 'Open the Foot region to label every tarsal individually.', region: 'overview' },

  // cranial
  frontal: { name: 'Frontal bone', latin: 'Os frontale', paired: false, blurb: 'Forms the forehead and the roofs of the orbits and nasal cavity.', pearl: 'Houses the frontal sinuses; the metopic suture normally fuses in early childhood.', region: 'cranial' },
  parietal: { name: 'Parietal bone', latin: 'Os parietale', paired: true, blurb: 'Paired bones forming most of the superior and lateral walls of the cranial vault.', pearl: 'The two parietals meet at the sagittal suture; bregma and lambda are key landmarks.', region: 'cranial' },
  temporal: { name: 'Temporal bone', latin: 'Os temporale', paired: true, blurb: 'Forms the lower lateral skull; houses the middle and inner ear.', pearl: 'Its squamous part is the thinnest skull bone — vulnerable to epidural hematoma (middle meningeal a.).', region: 'cranial' },
  occipital: { name: 'Occipital bone', latin: 'Os occipitale', paired: false, blurb: 'Forms the back and base of the skull around the foramen magnum.', pearl: 'The foramen magnum transmits the medulla/spinal cord junction and vertebral arteries.', region: 'cranial' },
  sphenoid: { name: 'Sphenoid bone', latin: 'Os sphenoidale', paired: false, blurb: 'Butterfly-shaped central skull-base bone articulating with all other cranial bones.', pearl: 'The sella turcica cradles the pituitary gland.', region: 'cranial' },
  ethmoid: { name: 'Ethmoid bone', latin: 'Os ethmoidale', paired: false, blurb: 'Light, spongy bone between the orbits forming part of the nasal cavity and septum.', pearl: 'The cribriform plate transmits olfactory nerves; fractures cause CSF rhinorrhea and anosmia.', region: 'cranial' },

  // facial
  maxilla: { name: 'Maxilla', latin: 'Maxilla', paired: true, blurb: 'Paired upper-jaw bones forming the central midface, orbit floor, and hard palate.', pearl: 'Houses the maxillary sinus (largest paranasal sinus) and the upper teeth.', region: 'facial' },
  zygomatic: { name: 'Zygomatic bone', latin: 'Os zygomaticum', paired: true, blurb: 'The cheekbone; forms the prominence of the cheek and lateral orbit.', pearl: 'Common site of facial fracture (tripod/ZMC fracture).', region: 'facial' },
  nasal: { name: 'Nasal bone', latin: 'Os nasale', paired: true, blurb: 'Paired bones forming the bridge of the nose.', pearl: 'The most commonly fractured facial bone.', region: 'facial' },
  lacrimal: { name: 'Lacrimal bone', latin: 'Os lacrimale', paired: true, blurb: 'Smallest, most fragile facial bone, in the medial orbital wall.', pearl: 'Forms the lacrimal fossa for the tear sac (nasolacrimal duct).', region: 'facial' },
  palatine: { name: 'Palatine bone', latin: 'Os palatinum', paired: true, blurb: 'L-shaped bone forming the posterior hard palate and part of the orbit/nasal cavity.', pearl: 'Cleft palate can involve failure of palatine shelf fusion.', region: 'facial' },
  'inferior-nasal-concha': { name: 'Inferior nasal concha', latin: 'Concha nasalis inferior', paired: true, blurb: 'Scroll-like bone on the lateral nasal wall that warms and humidifies air.', pearl: 'The only nasal concha that is a separate bone (others are part of the ethmoid).', region: 'facial' },
  vomer: { name: 'Vomer', latin: 'Vomer', paired: false, blurb: 'Thin midline bone forming the inferior/posterior nasal septum.', pearl: 'Deviation contributes to a deviated nasal septum.', region: 'facial' },
  mandible: { name: 'Mandible', latin: 'Mandibula', paired: false, blurb: 'The lower jaw — the only freely movable skull bone, holding the lower teeth.', pearl: 'Articulates at the TMJ; often fractures in two places due to its ring shape.', region: 'facial' },

  // ossicles + hyoid
  malleus: { name: 'Malleus', latin: 'Malleus', paired: true, blurb: 'Hammer-shaped ear ossicle attached to the tympanic membrane.', pearl: 'First in the ossicular chain: malleus → incus → stapes.', region: 'ossicles-hyoid' },
  incus: { name: 'Incus', latin: 'Incus', paired: true, blurb: 'Anvil-shaped middle ear ossicle between the malleus and stapes.', pearl: 'The most commonly disrupted ossicle in traumatic conductive hearing loss.', region: 'ossicles-hyoid' },
  stapes: { name: 'Stapes', latin: 'Stapes', paired: true, blurb: 'Stirrup-shaped ossicle; its footplate sits in the oval window.', pearl: 'The smallest bone in the body; fixation causes otosclerosis.', region: 'ossicles-hyoid' },
  hyoid: { name: 'Hyoid bone', latin: 'Os hyoideum', paired: false, blurb: 'U-shaped neck bone anchoring the tongue and larynx.', pearl: 'The only bone that articulates with no other bone; fracture suggests strangulation.', region: 'ossicles-hyoid' },

  // vertebral
  atlas: { name: 'Atlas (C1)', latin: 'Atlas', paired: false, blurb: 'The ring-shaped first cervical vertebra that supports the skull.', pearl: 'No body and no spinous process; nods "yes" at the atlanto-occipital joint. Jefferson burst fracture.', region: 'vertebral' },
  axis: { name: 'Axis (C2)', latin: 'Axis', paired: false, blurb: 'Second cervical vertebra; its dens (odontoid) is the pivot for head rotation.', pearl: 'Hangman fracture = bilateral pars fracture of C2; odontoid fractures are common in elderly falls.', region: 'vertebral' },
  'cervical-vertebrae': { name: 'Cervical vertebrae (C3–C7)', latin: 'Vertebrae cervicales', paired: false, blurb: 'Small neck vertebrae with transverse foramina for the vertebral arteries.', pearl: 'C7 (vertebra prominens) has the longest spinous process — a palpable landmark.', region: 'vertebral' },
  'thoracic-vertebrae': { name: 'Thoracic vertebrae (T1–T12)', latin: 'Vertebrae thoracicae', paired: false, blurb: 'Twelve vertebrae with costal facets that articulate with the ribs.', pearl: 'Long, downward-sloping spinous processes; kyphosis is the normal thoracic curve.', region: 'vertebral' },
  'lumbar-vertebrae': { name: 'Lumbar vertebrae (L1–L5)', latin: 'Vertebrae lumbales', paired: false, blurb: 'Five large weight-bearing vertebrae of the lower back.', pearl: 'L4/L5 is the most common level for disc herniation; LP is done below L2 (cord ends ~L1).', region: 'vertebral' },
  sacrum: { name: 'Sacrum', latin: 'Os sacrum', paired: false, blurb: 'Five fused vertebrae forming the posterior pelvis, articulating with the hip bones.', pearl: 'Transmits sacral nerve roots; the SI joints are a common low-back pain source.', region: 'vertebral' },
  coccyx: { name: 'Coccyx', latin: 'Os coccygis', paired: false, blurb: 'The tailbone — 3–5 fused rudimentary vertebrae.', pearl: 'Injured in falls onto the buttocks (coccydynia).', region: 'vertebral' },

  // thorax
  manubrium: { name: 'Manubrium', latin: 'Manubrium sterni', paired: false, blurb: 'Upper part of the sternum, articulating with the clavicles and first ribs.', pearl: 'Meets the body at the sternal angle (rib 2 landmark).', region: 'thorax' },
  'sternum-body': { name: 'Body of sternum', latin: 'Corpus sterni', paired: false, blurb: 'The long middle part of the sternum.', pearl: 'Overlies the heart — the site for sternal compressions/midline sternotomy.', region: 'thorax' },
  'xiphoid-process': { name: 'Xiphoid process', latin: 'Processus xiphoideus', paired: false, blurb: 'Small cartilaginous-to-bony tip at the inferior sternum.', pearl: 'Landmark for hand placement in CPR; can fracture during compressions.', region: 'thorax' },
  'true-ribs': { name: 'True ribs (1–7)', latin: 'Costae verae', paired: true, blurb: 'Ribs that attach directly to the sternum by their own costal cartilage.', pearl: '"Vertebrosternal" ribs — direct sternal attachment.', region: 'thorax' },
  'false-ribs': { name: 'False ribs (8–10)', latin: 'Costae spuriae', paired: true, blurb: 'Ribs whose cartilages join the rib above rather than the sternum directly.', pearl: 'Form the costal margin.', region: 'thorax' },
  'floating-ribs': { name: 'Floating ribs (11–12)', latin: 'Costae fluitantes', paired: true, blurb: 'Ribs with no anterior attachment, ending in the posterior abdominal wall.', pearl: 'Overlie the kidneys; rib 12 is a landmark for the costovertebral angle.', region: 'thorax' },

  // upper limb
  clavicle: { name: 'Clavicle', latin: 'Clavicula', paired: true, blurb: 'S-shaped collarbone connecting the sternum to the scapula.', pearl: 'Most commonly fractured bone in children; usually breaks at the middle third.', region: 'upper-limb' },
  scapula: { name: 'Scapula', latin: 'Scapula', paired: true, blurb: 'The shoulder blade — a flat triangular bone with the glenoid fossa.', pearl: 'Scapular fracture implies high-energy trauma; check for associated injuries.', region: 'upper-limb' },
  humerus: { name: 'Humerus', latin: 'Humerus', paired: true, blurb: 'The long bone of the upper arm, from shoulder to elbow.', pearl: 'Surgical neck fracture risks the axillary nerve; midshaft risks the radial nerve.', region: 'upper-limb' },
  radius: { name: 'Radius', latin: 'Radius', paired: true, blurb: 'The lateral (thumb-side) forearm bone.', pearl: 'Distal radius fracture = Colles (dorsal) or Smith (volar) — the most common forearm fracture.', region: 'upper-limb' },
  ulna: { name: 'Ulna', latin: 'Ulna', paired: true, blurb: 'The medial forearm bone; its olecranon forms the point of the elbow.', pearl: 'Nightstick fracture = isolated ulnar shaft from a direct blow.', region: 'upper-limb' },
  scaphoid: { name: 'Scaphoid', latin: 'Os scaphoideum', paired: true, blurb: 'Boat-shaped lateral carpal in the proximal row.', pearl: 'Most commonly fractured carpal; risk of avascular necrosis; tender in the anatomical snuffbox.', region: 'upper-limb' },
  lunate: { name: 'Lunate', latin: 'Os lunatum', paired: true, blurb: 'Moon-shaped proximal-row carpal next to the scaphoid.', pearl: 'Most commonly dislocated carpal; can cause acute carpal tunnel syndrome.', region: 'upper-limb' },
  triquetrum: { name: 'Triquetrum', latin: 'Os triquetrum', paired: true, blurb: 'Pyramidal proximal-row carpal on the medial side.', pearl: 'Second most commonly fractured carpal.', region: 'upper-limb' },
  pisiform: { name: 'Pisiform', latin: 'Os pisiforme', paired: true, blurb: 'Pea-shaped sesamoid carpal sitting on the triquetrum.', pearl: 'A sesamoid within the flexor carpi ulnaris tendon.', region: 'upper-limb' },
  trapezium: { name: 'Trapezium', latin: 'Os trapezium', paired: true, blurb: 'Distal-row carpal at the base of the thumb.', pearl: 'Forms the saddle joint of the thumb — a common site of osteoarthritis.', region: 'upper-limb' },
  trapezoid: { name: 'Trapezoid', latin: 'Os trapezoideum', paired: true, blurb: 'Small wedge-shaped distal-row carpal beside the trapezium.', pearl: 'The least commonly injured carpal.', region: 'upper-limb' },
  capitate: { name: 'Capitate', latin: 'Os capitatum', paired: true, blurb: 'The largest carpal, central in the distal row.', pearl: 'First carpal to ossify; the keystone of the wrist.', region: 'upper-limb' },
  hamate: { name: 'Hamate', latin: 'Os hamatum', paired: true, blurb: 'Wedge-shaped medial distal-row carpal with a hook (hamulus).', pearl: 'Hook fractures occur in racquet/club sports; risks the ulnar nerve (Guyon canal).', region: 'upper-limb' },
  metacarpals: { name: 'Metacarpals (I–V)', latin: 'Ossa metacarpi', paired: true, blurb: 'Five long bones of the palm connecting the carpus to the fingers.', pearl: 'Boxer fracture = neck of the 5th metacarpal.', region: 'upper-limb' },
  'hand-proximal-phalanges': { name: 'Proximal phalanges (hand)', latin: 'Phalanges proximales', paired: true, blurb: 'The first row of finger bones, one per digit including the thumb.', pearl: 'The thumb has only two phalanges (proximal + distal).', region: 'upper-limb' },
  'hand-middle-phalanges': { name: 'Middle phalanges (hand)', latin: 'Phalanges mediae', paired: true, blurb: 'The middle row of finger bones in digits 2–5.', pearl: 'Absent in the thumb.', region: 'upper-limb' },
  'hand-distal-phalanges': { name: 'Distal phalanges (hand)', latin: 'Phalanges distales', paired: true, blurb: 'The fingertip bones bearing the nail beds.', pearl: 'Tuft fractures are common crush injuries.', region: 'upper-limb' },

  // lower limb
  ilium: { name: 'Ilium', latin: 'Os ilium', paired: true, blurb: 'The large flaring superior part of the hip bone.', pearl: 'The iliac crest is a landmark (supracristal line ~ L4) and bone-marrow biopsy site.', region: 'lower-limb' },
  ischium: { name: 'Ischium', latin: 'Os ischii', paired: true, blurb: 'The posteroinferior part of the hip bone you sit on.', pearl: 'The ischial tuberosity bears weight when sitting; ischial spine is a pudendal block landmark.', region: 'lower-limb' },
  pubis: { name: 'Pubis', latin: 'Os pubis', paired: true, blurb: 'The anterior part of the hip bone meeting at the pubic symphysis.', pearl: 'Straddle injuries can fracture the pubic rami and damage the urethra.', region: 'lower-limb' },
  femur: { name: 'Femur', latin: 'Femur', paired: true, blurb: 'The thigh bone — the longest and strongest bone in the body.', pearl: 'Femoral neck fractures in the elderly risk avascular necrosis of the head.', region: 'lower-limb' },
  patella: { name: 'Patella', latin: 'Patella', paired: true, blurb: 'The kneecap — the largest sesamoid bone, within the quadriceps tendon.', pearl: 'Protects the knee and improves quadriceps leverage.', region: 'lower-limb' },
  tibia: { name: 'Tibia', latin: 'Tibia', paired: true, blurb: 'The shinbone — the larger, weight-bearing medial leg bone.', pearl: 'Most commonly fractured long bone; subcutaneous shaft → frequent open fractures.', region: 'lower-limb' },
  fibula: { name: 'Fibula', latin: 'Fibula', paired: true, blurb: 'The thin lateral leg bone; bears little weight.', pearl: 'Neck fracture endangers the common fibular (peroneal) nerve → foot drop.', region: 'lower-limb' },
  calcaneus: { name: 'Calcaneus', latin: 'Calcaneus', paired: true, blurb: 'The heel bone — the largest tarsal.', pearl: 'Fractured in falls from height; look for an associated L-spine burst fracture.', region: 'lower-limb' },
  talus: { name: 'Talus', latin: 'Talus', paired: true, blurb: 'The ankle bone transmitting body weight from the tibia to the foot.', pearl: 'No muscle attachments; fractures risk avascular necrosis.', region: 'lower-limb' },
  navicular: { name: 'Navicular', latin: 'Os naviculare', paired: true, blurb: 'Boat-shaped medial midfoot tarsal between the talus and cuneiforms.', pearl: 'Site of the accessory navicular and of stress fractures in athletes.', region: 'lower-limb' },
  cuboid: { name: 'Cuboid', latin: 'Os cuboideum', paired: true, blurb: 'Lateral midfoot tarsal anterior to the calcaneus.', pearl: 'Grooved by the fibularis longus tendon.', region: 'lower-limb' },
  'medial-cuneiform': { name: 'Medial cuneiform', latin: 'Os cuneiforme mediale', paired: true, blurb: 'Largest cuneiform, at the base of the first metatarsal.', pearl: 'Part of the Lisfranc (tarsometatarsal) joint complex.', region: 'lower-limb' },
  'intermediate-cuneiform': { name: 'Intermediate cuneiform', latin: 'Os cuneiforme intermedium', paired: true, blurb: 'Smallest cuneiform, at the base of the second metatarsal.', pearl: 'The recessed 2nd metatarsal base is the keystone of the Lisfranc joint.', region: 'lower-limb' },
  'lateral-cuneiform': { name: 'Lateral cuneiform', latin: 'Os cuneiforme laterale', paired: true, blurb: 'Cuneiform at the base of the third metatarsal, beside the cuboid.', pearl: 'Three cuneiforms: medial, intermediate, lateral (1st–3rd metatarsals).', region: 'lower-limb' },
  metatarsals: { name: 'Metatarsals (I–V)', latin: 'Ossa metatarsi', paired: true, blurb: 'Five long bones of the midfoot connecting the tarsus to the toes.', pearl: 'Jones fracture = base of the 5th metatarsal (poor healing); march fracture = stress fracture.', region: 'lower-limb' },
  'foot-proximal-phalanges': { name: 'Proximal phalanges (foot)', latin: 'Phalanges proximales', paired: true, blurb: 'First row of toe bones, one per toe including the great toe.', pearl: 'The hallux (great toe) has only two phalanges.', region: 'lower-limb' },
  'foot-middle-phalanges': { name: 'Middle phalanges (foot)', latin: 'Phalanges mediae', paired: true, blurb: 'Middle row of toe bones in toes 2–5.', pearl: 'Absent in the great toe.', region: 'lower-limb' },
  'foot-distal-phalanges': { name: 'Distal phalanges (foot)', latin: 'Phalanges distales', paired: true, blurb: 'The tip bones of the toes.', pearl: 'Stub injuries commonly fracture the distal phalanx of the hallux.', region: 'lower-limb' },
};

/* ---------- geometry: each view = clickable schematic ---------- */
/* Shapes carry data-bone (quiz id) or data-route (jump to another view). */

// Full skeleton = public-domain anatomical engraving + clickable hotspots (x,y,w,h in % of image).
// Big regions first so smaller specific bones stack on top and win the click.
const SKELETON_HOTSPOTS = [
  { id: 'ribs', x: 31, y: 18, w: 16, h: 15, route: 'thorax' },
  { id: 'ribs', x: 53, y: 18, w: 16, h: 15, route: 'thorax' },
  { id: 'scapula', x: 28, y: 18, w: 9, h: 6 },
  { id: 'scapula', x: 63, y: 18, w: 9, h: 6 },
  { id: 'clavicle', x: 33, y: 16, w: 15, h: 2.6 },
  { id: 'clavicle', x: 52, y: 16, w: 15, h: 2.6 },
  { id: 'humerus', x: 25, y: 19, w: 7, h: 13 },
  { id: 'humerus', x: 68, y: 19, w: 7, h: 13 },
  { id: 'sternum', x: 46, y: 19, w: 8, h: 13, route: 'thorax' },
  { id: 'vertebral-column', x: 45, y: 33, w: 9, h: 7, route: 'spine' },
  { id: 'radius', x: 20, y: 34, w: 5, h: 14 },
  { id: 'radius', x: 75, y: 34, w: 5, h: 14 },
  { id: 'ulna', x: 25, y: 34, w: 5, h: 14 },
  { id: 'ulna', x: 70, y: 34, w: 5, h: 14 },
  { id: 'hip-bone', x: 34, y: 40, w: 14, h: 12 },
  { id: 'hip-bone', x: 51, y: 40, w: 14, h: 12 },
  { id: 'hand', x: 14, y: 48, w: 13, h: 10, route: 'hand' },
  { id: 'hand', x: 73, y: 48, w: 13, h: 10, route: 'hand' },
  { id: 'femur', x: 40, y: 52, w: 8, h: 15 },
  { id: 'femur', x: 51, y: 52, w: 8, h: 15 },
  { id: 'patella', x: 39, y: 66, w: 6, h: 4 },
  { id: 'patella', x: 54, y: 66, w: 6, h: 4 },
  { id: 'fibula', x: 37, y: 71, w: 4, h: 17 },
  { id: 'fibula', x: 58, y: 71, w: 4, h: 17 },
  { id: 'tibia', x: 40, y: 70, w: 7, h: 18 },
  { id: 'tibia', x: 52, y: 70, w: 7, h: 18 },
  { id: 'foot', x: 33, y: 89, w: 13, h: 10, route: 'foot' },
  { id: 'foot', x: 47, y: 89, w: 13, h: 10, route: 'foot' },
  { id: 'skull', x: 40, y: 2, w: 18, h: 9, route: 'skull' },
  { id: 'mandible', x: 44, y: 12, w: 12, h: 4, route: 'skull' },
];

const SKULL_HOTSPOTS = [
  { id: 'frontal', x: 20, y: 4, w: 60, h: 32 },
  { id: 'parietal', x: 6, y: 14, w: 13, h: 28 }, { id: 'parietal', x: 81, y: 14, w: 13, h: 28 },
  { id: 'temporal', x: 6, y: 46, w: 15, h: 22 }, { id: 'temporal', x: 79, y: 46, w: 15, h: 22 },
  { id: 'maxilla', x: 34, y: 56, w: 32, h: 15 },
  { id: 'mandible', x: 27, y: 72, w: 46, h: 22 },
  { id: 'zygomatic', x: 28, y: 44, w: 13, h: 12 }, { id: 'zygomatic', x: 59, y: 44, w: 13, h: 12 },
  { id: 'sphenoid', x: 21, y: 40, w: 7, h: 10 }, { id: 'sphenoid', x: 72, y: 40, w: 7, h: 10 },
  { id: 'ethmoid', x: 46, y: 44, w: 8, h: 11 },
  { id: 'nasal', x: 45, y: 38, w: 10, h: 7 },
  { id: 'lacrimal', x: 39, y: 45, w: 5, h: 6 }, { id: 'lacrimal', x: 56, y: 45, w: 5, h: 6 },
  { id: 'vomer', x: 47, y: 58, w: 6, h: 9 },
  { id: 'inferior-nasal-concha', x: 43, y: 57, w: 4, h: 6 }, { id: 'inferior-nasal-concha', x: 53, y: 57, w: 4, h: 6 },
];

const THORAX_HOTSPOTS = [
  { id: 'true-ribs', x: 6, y: 4, w: 36, h: 48 }, { id: 'true-ribs', x: 58, y: 4, w: 36, h: 48 },
  { id: 'false-ribs', x: 6, y: 54, w: 34, h: 22 }, { id: 'false-ribs', x: 60, y: 54, w: 34, h: 22 },
  { id: 'floating-ribs', x: 8, y: 78, w: 26, h: 20 }, { id: 'floating-ribs', x: 66, y: 78, w: 26, h: 20 },
  { id: 'manubrium', x: 44, y: 3, w: 12, h: 12 },
  { id: 'sternum-body', x: 45, y: 16, w: 10, h: 35 },
  { id: 'xiphoid-process', x: 45, y: 52, w: 8, h: 11 },
];

const SPINE_HOTSPOTS = [
  { id: 'thoracic-vertebrae', x: 0, y: 15, w: 100, h: 43 },
  { id: 'lumbar-vertebrae', x: 0, y: 58, w: 100, h: 22 },
  { id: 'cervical-vertebrae', x: 0, y: 8, w: 100, h: 7 },
  { id: 'sacrum', x: 0, y: 80, w: 100, h: 13 },
  { id: 'coccyx', x: 0, y: 93, w: 100, h: 7 },
  { id: 'atlas', x: 0, y: 0, w: 100, h: 4 },
  { id: 'axis', x: 0, y: 4, w: 100, h: 4 },
];

const HAND_HOTSPOTS = [
  { id: 'metacarpals', x: 17, y: 56, w: 13, h: 12 }, { id: 'metacarpals', x: 30, y: 50, w: 9, h: 19 },
  { id: 'metacarpals', x: 42, y: 50, w: 9, h: 20 }, { id: 'metacarpals', x: 50, y: 52, w: 9, h: 18 }, { id: 'metacarpals', x: 56, y: 54, w: 9, h: 17 },
  { id: 'hand-proximal-phalanges', x: 13, y: 46, w: 16, h: 13 }, { id: 'hand-proximal-phalanges', x: 28, y: 30, w: 12, h: 20 },
  { id: 'hand-proximal-phalanges', x: 42, y: 26, w: 12, h: 21 }, { id: 'hand-proximal-phalanges', x: 60, y: 34, w: 13, h: 19 }, { id: 'hand-proximal-phalanges', x: 78, y: 40, w: 13, h: 15 },
  { id: 'hand-middle-phalanges', x: 29, y: 14, w: 12, h: 16 }, { id: 'hand-middle-phalanges', x: 43, y: 12, w: 11, h: 15 },
  { id: 'hand-middle-phalanges', x: 64, y: 20, w: 12, h: 15 }, { id: 'hand-middle-phalanges', x: 80, y: 30, w: 12, h: 13 },
  { id: 'hand-distal-phalanges', x: 12, y: 36, w: 15, h: 11 }, { id: 'hand-distal-phalanges', x: 28, y: 2, w: 12, h: 12 },
  { id: 'hand-distal-phalanges', x: 43, y: 0, w: 12, h: 11 }, { id: 'hand-distal-phalanges', x: 65, y: 6, w: 13, h: 13 }, { id: 'hand-distal-phalanges', x: 80, y: 18, w: 13, h: 12 },
  { id: 'trapezium', x: 32, y: 70, w: 8, h: 7 }, { id: 'trapezoid', x: 39, y: 70, w: 7, h: 6 },
  { id: 'capitate', x: 45, y: 70, w: 10, h: 9 }, { id: 'hamate', x: 53, y: 71, w: 9, h: 8 },
  { id: 'scaphoid', x: 31, y: 78, w: 9, h: 7 }, { id: 'lunate', x: 40, y: 79, w: 8, h: 6 },
  { id: 'triquetrum', x: 48, y: 80, w: 8, h: 6 }, { id: 'pisiform', x: 55, y: 81, w: 7, h: 5 },
];

const FOOT_HOTSPOTS = [
  // metatarsals first so the tarsals (below) win clicks where their bases overlap
  { id: 'metatarsals', x: 22, y: 30, w: 13, h: 18 }, { id: 'metatarsals', x: 35, y: 29, w: 10, h: 19 }, { id: 'metatarsals', x: 45, y: 30, w: 10, h: 19 }, { id: 'metatarsals', x: 55, y: 33, w: 9, h: 18 }, { id: 'metatarsals', x: 63, y: 36, w: 11, h: 16 },
  { id: 'calcaneus', x: 28, y: 73, w: 36, h: 25 },
  { id: 'talus', x: 30, y: 57, w: 27, h: 17 },
  { id: 'cuboid', x: 56, y: 51, w: 22, h: 19 },
  { id: 'navicular', x: 26, y: 54, w: 15, h: 8 },
  { id: 'medial-cuneiform', x: 22, y: 46, w: 13, h: 8 },
  { id: 'intermediate-cuneiform', x: 34, y: 48, w: 11, h: 9 },
  { id: 'lateral-cuneiform', x: 45, y: 49, w: 12, h: 10 },
  { id: 'foot-proximal-phalanges', x: 17, y: 14, w: 15, h: 14 }, { id: 'foot-proximal-phalanges', x: 33, y: 23, w: 11, h: 10 }, { id: 'foot-proximal-phalanges', x: 47, y: 25, w: 10, h: 10 }, { id: 'foot-proximal-phalanges', x: 60, y: 28, w: 10, h: 9 }, { id: 'foot-proximal-phalanges', x: 76, y: 33, w: 10, h: 8 },
  { id: 'foot-middle-phalanges', x: 33, y: 14, w: 11, h: 9 }, { id: 'foot-middle-phalanges', x: 47, y: 18, w: 10, h: 7 }, { id: 'foot-middle-phalanges', x: 61, y: 21, w: 9, h: 6 }, { id: 'foot-middle-phalanges', x: 77, y: 27, w: 9, h: 6 },
  { id: 'foot-distal-phalanges', x: 18, y: 4, w: 13, h: 11 }, { id: 'foot-distal-phalanges', x: 33, y: 6, w: 11, h: 9 }, { id: 'foot-distal-phalanges', x: 47, y: 11, w: 10, h: 8 }, { id: 'foot-distal-phalanges', x: 61, y: 15, w: 9, h: 7 }, { id: 'foot-distal-phalanges', x: 76, y: 20, w: 10, h: 7 },
];

// muscle hotspots — pr() mirrors a left-side box to the right (bilateral muscles)
const pr = (id, x, y, w, h) => [{ id, x, y, w, h }, { id, x: Math.round((100 - x - w) * 10) / 10, y, w, h }];
const MUSCLE_ANT_HOTSPOTS = [].concat(
  pr('temporalis', 40, 4, 6, 5), pr('masseter', 41, 10, 6, 4), pr('sternocleidomastoid', 43, 12, 5, 4),
  pr('trapezius', 34, 13, 9, 5), pr('deltoid', 30, 16, 10, 9), pr('pectoralis-major', 38, 18, 11, 9),
  pr('serratus-anterior', 35, 25, 5, 6), pr('biceps-brachii', 27, 23, 8, 11), pr('triceps-brachii', 20, 24, 6, 11),
  pr('brachioradialis', 22, 34, 6, 8), pr('forearm-flexors', 20, 41, 8, 9),
  [{ id: 'rectus-abdominis', x: 43, y: 30, w: 14, h: 15 }], pr('external-oblique', 37, 31, 6, 11),
  pr('vastus-lateralis', 34, 51, 7, 13), pr('rectus-femoris', 40, 52, 6, 13), pr('iliopsoas', 44, 44, 5, 6),
  pr('tensor-fasciae-latae', 36, 45, 6, 6), pr('sartorius', 44, 51, 5, 16), pr('adductor-longus', 46, 50, 4, 8),
  pr('gracilis', 47, 55, 3, 12), pr('vastus-medialis', 42, 63, 6, 7),
  pr('fibularis-longus', 39, 75, 4, 11), pr('tibialis-anterior', 42, 75, 6, 12), pr('gastrocnemius', 37, 75, 5, 10),
);
const MUSCLE_POST_HOTSPOTS = [].concat(
  pr('sternocleidomastoid', 42, 6, 5, 5), [{ id: 'trapezius', x: 40, y: 9, w: 20, h: 18 }], pr('deltoid', 30, 15, 10, 9),
  pr('infraspinatus', 36, 21, 8, 6), pr('teres-major', 36, 27, 7, 5), pr('latissimus-dorsi', 33, 29, 12, 12),
  pr('erector-spinae', 45, 30, 5, 13), pr('triceps-brachii', 26, 23, 7, 11), pr('forearm-extensors', 20, 35, 8, 11),
  pr('gluteus-medius', 37, 42, 6, 5), pr('gluteus-maximus', 38, 44, 11, 9), pr('iliotibial-tract', 34, 52, 4, 15),
  pr('biceps-femoris', 39, 55, 6, 13), pr('semitendinosus', 45, 56, 5, 12), pr('semimembranosus', 46, 60, 4, 8),
  pr('adductor-magnus', 46, 49, 4, 8), pr('fibularis-longus', 38, 73, 4, 10), pr('gastrocnemius', 40, 70, 7, 11),
  pr('soleus', 41, 80, 6, 6), pr('calcaneal-tendon', 44, 86, 4, 5),
);

// organ hotspots (filled below, %-coords); single-structure so no mirroring
const HEART_HS = [];
const BRAINLAT_HS = [
  { id: 'frontal-lobe', x: 6, y: 14, w: 34, h: 56 },
  { id: 'parietal-lobe', x: 52, y: 10, w: 26, h: 34 },
  { id: 'occipital-lobe', x: 78, y: 32, w: 16, h: 30 },
  { id: 'temporal-lobe', x: 36, y: 54, w: 34, h: 24 },
  { id: 'cerebellum', x: 56, y: 74, w: 22, h: 20 },
  { id: 'precentral-gyrus', x: 40, y: 16, w: 7, h: 44 },
  { id: 'postcentral-gyrus', x: 52, y: 14, w: 7, h: 32 },
  { id: 'central-sulcus', x: 46, y: 14, w: 6, h: 32 },
  { id: 'lateral-sulcus', x: 34, y: 45, w: 34, h: 7 },
  { id: 'pons', x: 45, y: 80, w: 10, h: 8 },
  { id: 'medulla', x: 45, y: 88, w: 10, h: 9 },
];
const BRAINSAG_HS = [
  { id: 'cingulate-gyrus', x: 27, y: 33, w: 25, h: 6 },
  { id: 'corpus-callosum', x: 26, y: 40, w: 30, h: 8, points: [[59.4,43.6],[56.5,41.3],[53.7,39.4],[51,38],[48.4,37.1],[45.8,36.6],[42.9,36.7],[39.7,37.2],[36.1,38.3],[32.1,39.8],[28.8,41.5],[26.1,43.2],[24,45],[22.5,46.8],[21.7,48.6],[21.3,50.1],[21.6,51.5],[22.4,52.8],[23.8,53.9],[25.7,54.9],[28.2,55.6],[31.2,56.2],[33.6,57],[35.4,58.1],[36.6,59.5],[37.2,61.1],[37.6,62.7],[37.7,64.4],[37.7,66.1],[37.4,67.9],[37.4,69.2],[37.6,70],[38.1,70.4],[38.8,70.3],[39.3,70.5],[39.8,70.8],[40.1,71.3],[40.2,72],[40.8,71.8],[41.7,70.7],[42.9,68.5],[44.5,65.5],[46.1,63.1],[47.7,61.3],[49.4,60.3],[51,59.9],[52,59.1],[52.4,57.9],[52.2,56.4],[51.3,54.4],[50.2,52.9],[48.9,51.8],[47.3,51],[45.4,50.7],[44,50.7],[43,50.9],[42.4,51.5],[42.1,52.3],[42,52.5],[41.9,52.1],[42,51.1],[42.1,49.5],[43.4,48.8],[46,49],[49.8,50.1],[54.9,52.1],[58.9,53.5],[61.7,54.2],[63.5,54.3],[64.2,53.7],[64.6,52.9],[64.7,51.9],[64.6,50.7],[64.2,49.3],[63.2,47.6],[61.6,45.8]] },
  { id: 'fornix', x: 35, y: 49, w: 13, h: 5 },
  { id: 'thalamus', x: 45, y: 51, w: 10, h: 8 },
  { id: 'pineal-gland', x: 53, y: 52, w: 5, h: 5 },
  { id: 'corpora-quadrigemina', x: 55, y: 57, w: 6, h: 5 },
  { id: 'hypothalamus', x: 40, y: 58, w: 8, h: 6 },
  { id: 'midbrain', x: 46, y: 59, w: 11, h: 8, points: [[45,67.5],[45.2,67.8],[45.4,68],[45.7,68.1],[46,68.1],[46.3,68],[46.6,67.8],[47,67.4],[47.4,67],[47.8,66.3],[48.1,65.9],[48.5,65.6],[48.7,65.5],[49,65.5],[49.2,65.7],[49.6,66],[50,66.5],[50.4,67.2],[50.9,67.6],[51.5,67.8],[52.1,67.8],[52.8,67.6],[53.5,67.5],[54.3,67.4],[55.1,67.5],[56,67.6],[56.9,67.5],[58,67.4],[59.1,67.1],[60.3,66.6],[61.1,66.3],[61.7,66],[62,65.8],[61.9,65.6],[61.7,65.5],[61.4,65.4],[60.9,65.4],[60.3,65.4],[59.8,65.3],[59.4,65],[59.2,64.6],[59,64],[58.6,63.5],[58,62.8],[57.2,62.2],[56.1,61.5],[55,60.9],[53.9,60.5],[52.7,60.2],[51.5,60.1],[50.5,60],[49.6,60],[49,60.2],[48.6,60.4],[48.1,60.7],[47.7,61],[47.3,61.4],[46.9,61.9],[46.5,62.5],[46.1,63.1],[45.7,63.8],[45.4,64.5],[45.1,65.2],[44.9,65.8],[44.8,66.2],[44.8,66.6],[44.8,66.9],[44.9,67.2]] },
  { id: 'pituitary-gland', x: 39, y: 65, w: 7, h: 6 },
  { id: 'pons', x: 48, y: 70, w: 12, h: 9, points: [[50.5,69.3],[50.3,69.7],[50,70.2],[49.9,70.8],[49.7,71.5],[49.6,72.2],[49.6,73.2],[49.8,74.3],[50,75.8],[50.4,77.4],[50.9,78.8],[51.4,80],[52,81.1],[52.6,81.9],[53.3,82.5],[54.1,83.1],[55,83.6],[55.9,84],[56.6,83.2],[57.1,81.3],[57.3,78.3],[57.3,74.2],[57,71.1],[56.5,69],[55.8,67.9],[54.8,67.8],[53.9,67.7],[53.1,67.8],[52.5,68],[51.8,68.2],[51.3,68.5],[50.9,68.9]] },
  { id: 'cerebellum', x: 60, y: 64, w: 15, h: 22, points: [[57.4,74.1],[57.4,78.3],[57.5,81.4],[57.8,83.5],[58.3,84.6],[58.9,84.6],[59.4,85],[59.9,85.9],[60.4,87.1],[60.9,88.8],[61.4,90],[61.9,90.6],[62.4,90.9],[63,90.6],[63.5,90.8],[64.2,91.3],[64.8,92.3],[65.5,93.7],[66.3,94.6],[67.3,94.9],[68.4,94.8],[69.6,94.1],[70.3,93.2],[70.4,92],[70,90.6],[69,88.9],[68.3,87],[67.7,84.8],[67.4,82.4],[67.2,79.8],[67,77.4],[66.7,75.3],[66.2,73.5],[65.7,72],[65.2,70.7],[64.6,69.5],[64.1,68.5],[63.5,67.7],[62.7,67.1],[61.8,66.9],[60.7,67],[59.4,67.3],[58.4,68.7],[57.7,70.9]] },
  { id: 'medulla', x: 50, y: 83, w: 10, h: 12, points: [[66.5,80.5],[65.9,81],[65.3,81.4],[64.7,81.7],[64.1,82],[63.5,82.1],[62.9,82.3],[62.4,82.7],[61.9,83.1],[61.5,83.6],[61.1,84],[60.8,84.3],[60.5,84.5],[60.2,84.7],[60.1,85.1],[60.2,85.9],[60.5,87],[60.9,88.5],[61.2,89.6],[61.6,90.3],[62,90.7],[62.4,90.8],[62.7,90.9],[62.9,91.1],[63,91.4],[63.1,91.8],[63.3,92.3],[63.7,93],[64.3,93.8],[65.1,94.8],[66,95.3],[67,95.4],[68.2,95],[69.5,94.3],[70.5,93.6],[71.2,93.1],[71.4,92.7],[71.4,92.4],[71.3,92.2],[71.1,92],[70.9,91.9],[70.7,91.9],[70.4,91.7],[70.3,91.5],[70.2,91.1],[70.2,90.6],[70,90],[69.8,89.3],[69.4,88.4],[69,87.4],[68.6,86.2],[68.2,85],[67.9,83.5],[67.7,82],[67.4,81],[67,80.5]] },
];
const RESP_HS = [];
const KIDNEY_HS = [];
const NEURON_HS = [
  { id: 'dendrites', x: 2, y: 8, w: 20, h: 74 },
  { id: 'soma', x: 18, y: 36, w: 22, h: 32 },
  { id: 'nucleus', x: 25, y: 46, w: 10, h: 12 },
  { id: 'axon-hillock', x: 38, y: 40, w: 7, h: 12 },
  { id: 'axon', x: 46, y: 42, w: 12, h: 12 },
  { id: 'myelin-sheath', x: 60, y: 42, w: 16, h: 12 },
  { id: 'node-of-ranvier', x: 76, y: 46, w: 5, h: 9 },
  { id: 'axon-terminal', x: 46, y: 3, w: 16, h: 25 },
  { id: 'schwann-cell', x: 62, y: 56, w: 26, h: 16 },
];
const EYE_HS = [];
const EAR_HS = [];

const VIEWS = {
  skeleton: { label: 'Full skeleton', type: 'image', img: 'assets/skeleton.svg', ratio: 0.518, hotspots: SKELETON_HOTSPOTS },
  heart: { label: 'Heart', type: 'image', img: 'assets/heart.svg', ratio: 0.943, hotspots: HEART_HS },
  'brain-lateral': { label: 'Brain — lateral', type: 'image', img: 'assets/brain-lateral.svg', ratio: 1.358, hotspots: BRAINLAT_HS },
  'brain-sagittal': { label: 'Brain — sagittal', type: 'image', img: 'assets/brain-sagittal.png', ratio: 1.261, hotspots: BRAINSAG_HS },
  respiratory: { label: 'Lungs & airways', type: 'image', img: 'assets/respiratory.svg', ratio: 0.946, hotspots: RESP_HS },
  kidney: { label: 'Kidney', type: 'image', img: 'assets/kidney.svg', ratio: 0.802, hotspots: KIDNEY_HS },
  neuron: { label: 'Neuron', type: 'image', img: 'assets/neuron.svg', ratio: 1.364, hotspots: NEURON_HS },
  eye: { label: 'Eye', type: 'image', img: 'assets/eye.svg', ratio: 0.963, hotspots: EYE_HS },
  ear: { label: 'Ear', type: 'image', img: 'assets/ear.svg', ratio: 1.291, hotspots: EAR_HS },
  'muscles-anterior': { label: 'Muscles — front', type: 'image', img: 'assets/muscles-anterior.png', ratio: 0.536, hotspots: MUSCLE_ANT_HOTSPOTS },
  'muscles-posterior': { label: 'Muscles — back', type: 'image', img: 'assets/muscles-posterior.png', ratio: 0.515, hotspots: MUSCLE_POST_HOTSPOTS },
  skull: { label: 'Skull', type: 'image', img: 'assets/skull.svg', ratio: 0.717, hotspots: SKULL_HOTSPOTS },
  spine: { label: 'Spine', type: 'image', img: 'assets/spine.svg', ratio: 0.201, hotspots: SPINE_HOTSPOTS },
  thorax: { label: 'Thorax', type: 'image', img: 'assets/thorax.svg', ratio: 1.013, hotspots: THORAX_HOTSPOTS },
  hand: { label: 'Hand & wrist', type: 'image', img: 'assets/hand.svg', ratio: 0.586, hotspots: HAND_HOTSPOTS },
  foot: { label: 'Foot & ankle', type: 'image', img: 'assets/foot.svg', ratio: 0.375, hotspots: FOOT_HOTSPOTS },
};
const REGION_ORDER = ['skeleton', 'skull', 'spine', 'thorax', 'hand', 'foot'];
const SYSTEMS = {
  skeletal: { label: 'Skeletal', sub: 'All 206 bones', regions: REGION_ORDER },
  muscular: { label: 'Muscular', sub: 'Superficial muscles', regions: ['muscles-anterior', 'muscles-posterior'] },
  organs: { label: 'Organs', sub: 'Brain & more', regions: ['brain-lateral', 'brain-sagittal', 'neuron'] },
};

// which bone ids are quiz targets in each view (order independent)
const VIEW_BONES = {
  skeleton: ['skull', 'mandible', 'clavicle', 'scapula', 'sternum', 'ribs', 'vertebral-column', 'humerus', 'radius', 'ulna', 'hip-bone', 'femur', 'patella', 'tibia', 'fibula', 'hand', 'foot'],
  skull: ['frontal', 'parietal', 'temporal', 'sphenoid', 'ethmoid', 'nasal', 'lacrimal', 'zygomatic', 'maxilla', 'mandible', 'vomer', 'inferior-nasal-concha'],
  spine: ['atlas', 'axis', 'cervical-vertebrae', 'thoracic-vertebrae', 'lumbar-vertebrae', 'sacrum', 'coccyx'],
  thorax: ['manubrium', 'sternum-body', 'xiphoid-process', 'true-ribs', 'false-ribs', 'floating-ribs'],
  hand: ['scaphoid', 'lunate', 'triquetrum', 'pisiform', 'trapezium', 'trapezoid', 'capitate', 'hamate', 'metacarpals', 'hand-proximal-phalanges', 'hand-middle-phalanges', 'hand-distal-phalanges'],
  foot: ['calcaneus', 'talus', 'navicular', 'cuboid', 'medial-cuneiform', 'intermediate-cuneiform', 'lateral-cuneiform', 'metatarsals', 'foot-proximal-phalanges', 'foot-middle-phalanges', 'foot-distal-phalanges'],
  'muscles-anterior': ['temporalis', 'masseter', 'sternocleidomastoid', 'trapezius', 'deltoid', 'pectoralis-major', 'serratus-anterior', 'biceps-brachii', 'triceps-brachii', 'brachioradialis', 'forearm-flexors', 'rectus-abdominis', 'external-oblique', 'iliopsoas', 'tensor-fasciae-latae', 'sartorius', 'rectus-femoris', 'vastus-lateralis', 'vastus-medialis', 'adductor-longus', 'gracilis', 'tibialis-anterior', 'gastrocnemius', 'fibularis-longus'],
  'muscles-posterior': ['sternocleidomastoid', 'trapezius', 'deltoid', 'infraspinatus', 'teres-major', 'latissimus-dorsi', 'triceps-brachii', 'forearm-extensors', 'erector-spinae', 'gluteus-medius', 'gluteus-maximus', 'iliotibial-tract', 'biceps-femoris', 'semitendinosus', 'semimembranosus', 'adductor-magnus', 'gastrocnemius', 'soleus', 'calcaneal-tendon', 'fibularis-longus'],
  'heart': ['right-atrium', 'right-ventricle', 'left-atrium', 'left-ventricle', 'aorta', 'pulmonary-trunk', 'superior-vena-cava', 'inferior-vena-cava', 'pulmonary-arteries', 'pulmonary-veins', 'lad-artery', 'right-coronary-artery', 'apex'],
  'brain-lateral': ['frontal-lobe', 'parietal-lobe', 'temporal-lobe', 'occipital-lobe', 'cerebellum', 'pons', 'medulla', 'precentral-gyrus', 'postcentral-gyrus', 'central-sulcus', 'lateral-sulcus'],
  'brain-sagittal': ['corpus-callosum', 'thalamus', 'hypothalamus', 'pituitary-gland', 'midbrain', 'pons', 'medulla', 'cerebellum', 'fornix', 'pineal-gland', 'cingulate-gyrus', 'corpora-quadrigemina'],
  'respiratory': ['larynx', 'trachea', 'right-main-bronchus', 'left-main-bronchus', 'right-upper-lobe', 'right-middle-lobe', 'right-lower-lobe', 'left-upper-lobe', 'left-lower-lobe', 'bronchioles', 'diaphragm'],
  'kidney': ['renal-cortex', 'renal-medulla', 'renal-pyramid', 'renal-column', 'renal-pelvis', 'major-calyx', 'minor-calyx', 'ureter', 'renal-artery', 'renal-vein', 'renal-capsule', 'renal-hilum'],
  'neuron': ['dendrites', 'soma', 'nucleus', 'axon-hillock', 'axon', 'myelin-sheath', 'node-of-ranvier', 'axon-terminal', 'schwann-cell'],
  'eye': ['cornea', 'iris', 'pupil', 'lens', 'retina', 'optic-nerve', 'sclera', 'choroid', 'vitreous-body', 'ciliary-body', 'fovea', 'anterior-chamber'],
  'ear': ['auricle', 'external-acoustic-meatus', 'tympanic-membrane', 'malleus', 'incus', 'stapes', 'cochlea', 'semicircular-canals', 'vestibule', 'eustachian-tube', 'vestibulocochlear-nerve'],
};

/* ---------- SVG builders (schematic, anterior unless noted) ---------- */

function g(id, inner, route) {
  const attr = route ? `data-route="${route}"` : `data-bone="${id}"`;
  return `<g class="bone${route ? ' route' : ''}" ${attr}><title>${(BONE_META[id] || {}).name || id}</title>${inner}</g>`;
}

function skeletonSVG() {
  const mc = (x) => x, m = (x) => 360 - x; // mirror helper
  return `
  ${g('skull', `<ellipse cx="180" cy="48" rx="30" ry="36"/>`)}
  ${g('mandible', `<path d="M152 78 Q180 100 208 78 Q206 92 180 96 Q154 92 152 78 Z"/>`)}
  ${g('vertebral-column', `<rect x="174" y="86" width="12" height="346" rx="4"/>`, 'spine')}
  ${g('clavicle', `<path d="M178 100 L120 110 L120 116 L178 108 Z"/><path d="M182 100 L240 110 L240 116 L182 108 Z"/>`)}
  ${g('scapula', `<polygon points="116,112 150,118 138,158 110,150"/><polygon points="244,112 210,118 222,158 250,150"/>`)}
  ${g('sternum', `<rect x="172" y="112" width="16" height="70" rx="3"/>`, 'thorax')}
  ${g('ribs', `<path d="M170 120 Q120 130 118 175 Q120 200 168 205" /><path d="M170 134 Q128 144 126 180 Q130 200 168 210"/><path d="M170 148 Q136 158 134 186 Q140 202 168 216"/><path d="M190 120 Q240 130 242 175 Q240 200 192 205"/><path d="M190 134 Q232 144 234 180 Q230 200 192 210"/><path d="M190 148 Q224 158 226 186 Q220 202 192 216"/>`, 'thorax')}
  ${g('humerus', `<rect x="104" y="116" width="13" height="120" rx="6" transform="rotate(6 110 176)"/><rect x="243" y="116" width="13" height="120" rx="6" transform="rotate(-6 250 176)"/>`)}
  ${g('radius', `<rect x="92" y="240" width="9" height="104" rx="4" transform="rotate(4 96 292)"/><rect x="259" y="240" width="9" height="104" rx="4" transform="rotate(-4 264 292)"/>`)}
  ${g('ulna', `<rect x="104" y="240" width="9" height="106" rx="4" transform="rotate(4 108 293)"/><rect x="247" y="240" width="9" height="106" rx="4" transform="rotate(-4 252 293)"/>`)}
  ${g('hand', `<rect x="86" y="350" width="26" height="40" rx="6"/><rect x="248" y="350" width="26" height="40" rx="6"/>`, 'hand')}
  ${g('hip-bone', `<path d="M150 432 Q120 440 128 478 Q150 500 180 498 Q210 500 232 478 Q240 440 210 432 Q180 446 150 432 Z"/>`, 'spine')}
  ${g('femur', `<rect x="150" y="500" width="14" height="128" rx="7" transform="rotate(3 157 564)"/><rect x="196" y="500" width="14" height="128" rx="7" transform="rotate(-3 203 564)"/>`)}
  ${g('patella', `<circle cx="156" cy="634" r="9"/><circle cx="204" cy="634" r="9"/>`)}
  ${g('tibia', `<rect x="150" y="646" width="12" height="120" rx="5"/><rect x="198" y="646" width="12" height="120" rx="5"/>`)}
  ${g('fibula', `<rect x="140" y="650" width="7" height="112" rx="3"/><rect x="213" y="650" width="7" height="112" rx="3"/>`)}
  ${g('foot', `<path d="M140 770 Q132 786 158 786 L172 778 L160 768 Z"/><path d="M220 770 Q228 786 202 786 L188 778 L200 768 Z"/>`, 'foot')}
  `;
}

function skullSVG() {
  return `
  ${g('frontal', `<path d="M104 96 Q180 30 256 96 Q258 120 244 138 L116 138 Q102 120 104 96 Z"/>`)}
  ${g('parietal', `<path d="M104 96 Q92 70 120 60 L120 96 Z"/><path d="M256 96 Q268 70 240 60 L240 96 Z"/>`)}
  ${g('temporal', `<path d="M104 138 Q92 160 110 188 L130 176 L116 138 Z"/><path d="M256 138 Q268 160 250 188 L230 176 L244 138 Z"/>`)}
  ${g('occipital', `<path d="M120 60 Q180 40 240 60 L240 52 Q180 30 120 52 Z"/>`)}
  ${g('sphenoid', `<rect x="138" y="150" width="20" height="14" rx="3"/><rect x="202" y="150" width="20" height="14" rx="3"/>`)}
  ${g('ethmoid', `<rect x="170" y="150" width="20" height="22" rx="2"/>`)}
  ${g('nasal', `<rect x="170" y="142" width="9" height="22"/><rect x="181" y="142" width="9" height="22"/>`)}
  ${g('lacrimal', `<rect x="150" y="150" width="9" height="9"/><rect x="201" y="150" width="9" height="9"/>`)}
  ${g('zygomatic', `<path d="M118 176 L150 184 L146 210 L120 200 Z"/><path d="M242 176 L210 184 L214 210 L240 200 Z"/>`)}
  ${g('maxilla', `<path d="M146 200 L180 196 L214 200 L210 244 Q180 252 150 244 Z"/>`)}
  ${g('inferior-nasal-concha', `<rect x="170" y="190" width="20" height="8" rx="2"/>`)}
  ${g('vomer', `<polygon points="180,176 184,200 176,200"/>`)}
  ${g('palatine', `<rect x="164" y="246" width="32" height="8" rx="2"/>`)}
  ${g('mandible', `<path d="M132 250 Q180 300 228 250 L222 276 Q180 312 138 276 Z"/>`)}
  ${g('hyoid', `<path d="M150 332 Q180 346 210 332" fill="none"/>`)}
  <g class="ear-inset">
    ${g('malleus', `<rect x="292" y="150" width="8" height="20" rx="3"/>`)}
    ${g('incus', `<rect x="304" y="150" width="8" height="20" rx="3"/>`)}
    ${g('stapes', `<rect x="316" y="150" width="8" height="20" rx="3"/>`)}
    <text x="292" y="186" class="anat-mini">ear ossicles</text>
  </g>
  `;
}

function spineSVG() {
  // lateral column with curves
  let v = '';
  // cervical C3-C7 (5 small)
  for (let i = 0; i < 5; i++) v += `<rect x="${96 + i * 2}" y="${96 + i * 16}" width="22" height="13" rx="3"/>`;
  let cerv = g('cervical-vertebrae', v);
  let t = '';
  for (let i = 0; i < 12; i++) t += `<rect x="${110 - i * 1.2}" y="${178 + i * 15}" width="26" height="12" rx="3"/>`;
  let thor = g('thoracic-vertebrae', t);
  let l = '';
  for (let i = 0; i < 5; i++) l += `<rect x="${96 + i * 1.5}" y="${360 + i * 20}" width="32" height="16" rx="3"/>`;
  let lum = g('lumbar-vertebrae', l);
  return `
  ${g('atlas', `<rect x="98" y="64" width="22" height="13" rx="6"/>`)}
  ${g('axis', `<rect x="97" y="79" width="23" height="14" rx="4"/>`)}
  ${cerv}
  ${thor}
  ${lum}
  ${g('sacrum', `<path d="M98 462 L130 462 L120 520 L104 520 Z"/>`)}
  ${g('coccyx', `<path d="M106 522 L118 522 L112 548 Z"/>`)}
  `;
}

function thoraxSVG() {
  let ribsT = '';
  for (let i = 0; i < 7; i++) {
    const y = 70 + i * 22;
    ribsT += `<path d="M168 ${y} Q90 ${y + 18} 92 ${y + 40}" fill="none"/>`;
    ribsT += `<path d="M172 ${y} Q250 ${y + 18} 248 ${y + 40}" fill="none"/>`;
  }
  let falseT = '';
  for (let i = 0; i < 3; i++) {
    const y = 226 + i * 20;
    falseT += `<path d="M168 ${y} Q96 ${y + 16} 108 ${y + 34}" fill="none"/>`;
    falseT += `<path d="M172 ${y} Q244 ${y + 16} 232 ${y + 34}" fill="none"/>`;
  }
  let floatT = '';
  for (let i = 0; i < 2; i++) {
    const y = 290 + i * 18;
    floatT += `<path d="M150 ${y} Q110 ${y + 10} 118 ${y + 22}" fill="none"/>`;
    floatT += `<path d="M190 ${y} Q230 ${y + 10} 222 ${y + 22}" fill="none"/>`;
  }
  return `
  ${g('manubrium', `<path d="M156 60 L184 60 L182 92 L158 92 Z"/>`)}
  ${g('sternum-body', `<rect x="160" y="94" width="20" height="120" rx="3"/>`)}
  ${g('xiphoid-process', `<polygon points="162,216 178,216 170,238"/>`)}
  ${g('true-ribs', ribsT)}
  ${g('false-ribs', falseT)}
  ${g('floating-ribs', floatT)}
  `;
}

function handSVG() {
  // dorsal right hand, wrist at bottom
  return `
  ${g('scaphoid', `<ellipse cx="120" cy="350" rx="14" ry="18"/>`)}
  ${g('lunate', `<ellipse cx="150" cy="346" rx="14" ry="16"/>`)}
  ${g('triquetrum', `<ellipse cx="178" cy="352" rx="12" ry="14"/>`)}
  ${g('pisiform', `<circle cx="196" cy="360" r="9"/>`)}
  ${g('trapezium', `<ellipse cx="112" cy="312" rx="13" ry="14"/>`)}
  ${g('trapezoid', `<ellipse cx="140" cy="312" rx="12" ry="13"/>`)}
  ${g('capitate', `<ellipse cx="168" cy="312" rx="15" ry="16"/>`)}
  ${g('hamate', `<ellipse cx="196" cy="316" rx="13" ry="15"/>`)}
  ${g('metacarpals', `<rect x="74" y="232" width="11" height="64" rx="4" transform="rotate(18 80 264)"/><rect x="104" y="220" width="11" height="74" rx="4"/><rect x="134" y="216" width="11" height="78" rx="4"/><rect x="164" y="220" width="11" height="74" rx="4"/><rect x="192" y="228" width="11" height="66" rx="4" transform="rotate(-10 197 260)"/>`)}
  ${g('hand-proximal-phalanges', `<rect x="56" y="180" width="10" height="42" rx="4" transform="rotate(24 61 200)"/><rect x="104" y="158" width="10" height="56" rx="4"/><rect x="134" y="150" width="10" height="60" rx="4"/><rect x="164" y="158" width="10" height="56" rx="4"/><rect x="196" y="172" width="10" height="50" rx="4" transform="rotate(-14 201 196)"/>`)}
  ${g('hand-middle-phalanges', `<rect x="104" y="112" width="10" height="42" rx="4"/><rect x="134" y="104" width="10" height="42" rx="4"/><rect x="164" y="112" width="10" height="42" rx="4"/><rect x="200" y="130" width="10" height="38" rx="4" transform="rotate(-14 205 148)"/>`)}
  ${g('hand-distal-phalanges', `<rect x="40" y="150" width="9" height="30" rx="4" transform="rotate(24 44 164)"/><rect x="104" y="76" width="9" height="32" rx="4"/><rect x="134" y="66" width="9" height="34" rx="4"/><rect x="164" y="76" width="9" height="32" rx="4"/><rect x="204" y="96" width="9" height="30" rx="4" transform="rotate(-14 208 110)"/>`)}
  `;
}

function footSVG() {
  // superior view, heel left, toes right
  return `
  ${g('calcaneus', `<path d="M30 120 Q24 158 60 168 L96 158 L92 116 Q60 104 30 120 Z"/>`)}
  ${g('talus', `<ellipse cx="108" cy="138" rx="22" ry="20"/>`)}
  ${g('navicular', `<path d="M138 116 Q150 138 138 160 L150 160 Q162 138 150 116 Z"/>`)}
  ${g('cuboid', `<rect x="140" y="166" width="34" height="30" rx="4"/>`)}
  ${g('lateral-cuneiform', `<rect x="166" y="138" width="24" height="22" rx="3"/>`)}
  ${g('intermediate-cuneiform', `<rect x="166" y="116" width="24" height="20" rx="3"/>`)}
  ${g('medial-cuneiform', `<rect x="166" y="94" width="26" height="20" rx="3"/>`)}
  ${g('metatarsals', `<rect x="196" y="86" width="11" height="58" rx="4"/><rect x="200" y="116" width="11" height="56" rx="4"/><rect x="200" y="150" width="11" height="52" rx="4"/><rect x="198" y="182" width="11" height="48" rx="4"/><rect x="188" y="208" width="11" height="44" rx="4" transform="rotate(-8 193 230)"/>`)}
  ${g('foot-proximal-phalanges', `<rect x="262" y="82" width="10" height="40" rx="4"/><rect x="266" y="120" width="10" height="36" rx="4"/><rect x="266" y="156" width="10" height="34" rx="4"/><rect x="262" y="188" width="10" height="32" rx="4"/><rect x="250" y="218" width="10" height="28" rx="4" transform="rotate(-8 255 232)"/>`)}
  ${g('foot-middle-phalanges', `<rect x="290" y="122" width="9" height="26" rx="4"/><rect x="290" y="156" width="9" height="24" rx="4"/><rect x="286" y="186" width="9" height="22" rx="4"/><rect x="274" y="214" width="9" height="20" rx="4" transform="rotate(-8 278 224)"/>`)}
  ${g('foot-distal-phalanges', `<rect x="284" y="64" width="10" height="18" rx="4"/><rect x="312" y="124" width="8" height="18" rx="4"/><rect x="312" y="156" width="8" height="18" rx="4"/><rect x="306" y="184" width="8" height="18" rx="4"/><rect x="292" y="210" width="8" height="16" rx="4" transform="rotate(-8 296 218)"/>`)}
  `;
}

/* ---------- state ---------- */
let anat = null;
let anatMode = 'explore';
let anatSystem = 'skeletal';
const ANAT_STORE = (typeof loadJSON === 'function') ? loadJSON('cs-anat', {}) : {};
function saveAnat() { localStorage.setItem('cs-anat', JSON.stringify(ANAT_STORE)); }
function bestFor(view, mode) { return ANAT_STORE[view]?.[mode] ?? null; }

async function loadBones() {
  if (BONE_META.__loaded) return;
  for (const file of ['data/bones.json', 'data/muscles.json', 'data/organs.json']) {
    try {
      const r = await fetch(file);
      if (!r.ok) continue;
      const arr = await r.json();
      for (const b of arr) {
        const m = BONE_META[b.id];
        if (m) { m.latin = b.latin || m.latin; m.blurb = b.blurb || m.blurb; m.pearl = b.pearl || m.pearl; if (typeof b.paired === 'boolean') m.paired = b.paired; }
        else BONE_META[b.id] = { name: b.name, latin: b.latin, paired: b.paired, blurb: b.blurb, pearl: b.pearl, region: b.region };
      }
    } catch { /* fallback meta is fine */ }
  }
  BONE_META.__loaded = true;
}

function shuffle(a) { const x = a.slice(); for (let i = x.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [x[i], x[j]] = [x[j], x[i]]; } return x; }

// figure element for a view (image+hotspots or inline svg). idAttr adds id="fig".
function figEl(v, idAttr) {
  const id = idAttr ? ' id="fig"' : '';
  if (v.type === 'image') {
    const shapes = v.hotspots.map(h => {
      const nm = (BONE_META[h.id] || {}).name || h.id;
      const a = `class="bone hot" data-bone="${h.id}"${h.route ? ` data-route="${h.route}"` : ''} vector-effect="non-scaling-stroke"`;
      const tip = `<title>${esc(nm)}</title>`;
      if (h.points && h.points.length > 2) {
        return `<polygon ${a} points="${h.points.map(p => p.join(',')).join(' ')}">${tip}</polygon>`;
      }
      const cx = (h.x + h.w / 2).toFixed(2), cy = (h.y + h.h / 2).toFixed(2), rx = (h.w / 2).toFixed(2), ry = (h.h / 2).toFixed(2);
      return `<ellipse ${a} cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}">${tip}</ellipse>`;
    }).join('');
    return `<div${id} class="anat-img" style="aspect-ratio:${v.ratio}"><img src="${v.img}" alt="${esc(v.label)}" draggable="false"><svg class="hot-layer" viewBox="0 0 100 100" preserveAspectRatio="none">${shapes}</svg></div>`;
  }
  return `<svg${id} viewBox="${v.viewBox}" preserveAspectRatio="xMidYMid meet">${v.svg}</svg>`;
}
function thumbEl(v) {
  if (v.type === 'image') return `<span class="rc-svg rc-img"><img src="${v.img}" alt=""></span>`;
  return `<span class="rc-svg"><svg viewBox="${v.viewBox}" preserveAspectRatio="xMidYMid meet">${v.svg}</svg></span>`;
}

/* ---------- render: region/mode picker ---------- */

async function renderAnatomy() {
  if (typeof stopTimer === 'function') stopTimer();
  if (typeof session !== 'undefined') session = null;
  await loadBones();

  const sys = SYSTEMS[anatSystem];
  const root = el(`<div></div>`);
  root.appendChild(topbar('anatomy'));
  const main = el(`<main class="panel anat-home">
    <div class="hero"><h1>Anatomy.</h1><p class="sub">Pick a system and region, then learn or test yourself.</p></div>
    <div class="ctl"><span class="label">System</span>
      <div class="modes" id="asys">
        ${Object.entries(SYSTEMS).map(([k, s]) => `<button class="mode ${k === anatSystem ? 'active' : ''}" data-asys="${k}">${esc(s.label)}</button>`).join('')}
      </div>
    </div>
    <div class="ctl" style="margin-top:18px"><span class="label">Mode</span>
      <div class="modes" id="amode">
        <button class="mode ${anatMode === 'explore' ? 'active' : ''}" data-amode="explore">Explore</button>
        <button class="mode ${anatMode === 'find' ? 'active' : ''}" data-amode="find">Find it</button>
        <button class="mode ${anatMode === 'name' ? 'active' : ''}" data-amode="name">Name it</button>
      </div>
    </div>
    <p class="anat-modehint" id="amh"></p>
    <div class="region-grid"></div>
    <p class="anat-credit">Anatomy figures from Wikimedia Commons (LadyofHats, Mikael Häggström, mikeingram1/MJL, VonTasha/mario modest, OpenStax) — public domain, CC0, CC BY 4.0 &amp; CC BY-SA 3.0. Labels removed.</p>
  </main>`);

  const hints = {
    explore: 'Browse a region — hover or click any structure to see its name, Latin, and a clinical pearl.',
    find: 'We name a structure; you click it on the diagram.',
    name: 'We highlight a structure; you pick its name from four choices.',
  };
  const amh = main.querySelector('#amh');
  amh.textContent = hints[anatMode];

  const rg = main.querySelector('.region-grid');
  sys.regions.forEach(key => {
    const v = VIEWS[key];
    const n = VIEW_BONES[key].length;
    const fb = bestFor(key, 'find'), nb = bestFor(key, 'name');
    const best = Math.max(fb ?? -1, nb ?? -1);
    const label = anatSystem === 'muscular' ? 'muscles' : anatSystem === 'organs' ? 'parts' : 'bones';
    const bestTxt = best >= 0 ? `BEST ${best}/${n}${best === n ? ' &#9733;' : ''}` : `${n} ${label}`;
    const card = el(`<button class="rcard">
      ${thumbEl(v)}
      <span class="rc-meta"><span class="rc-name">${esc(v.label)}</span><span class="rc-count">${bestTxt}</span></span>
    </button>`);
    card.addEventListener('click', () => startAnat(key, anatMode));
    rg.appendChild(card);
  });

  main.querySelectorAll('#asys .mode').forEach(b => b.addEventListener('click', () => {
    if (anatSystem === b.dataset.asys) return;
    anatSystem = b.dataset.asys;
    renderAnatomy();
  }));
  main.querySelectorAll('#amode .mode').forEach(b => b.addEventListener('click', () => {
    anatMode = b.dataset.amode;
    main.querySelectorAll('#amode .mode').forEach(x => x.classList.toggle('active', x === b));
    amh.textContent = hints[anatMode];
  }));

  root.appendChild(main);
  setView(root);
}

/* ---------- render: a region game ---------- */

function startAnat(view, mode) {
  const bones = VIEW_BONES[view].filter(id => BONE_META[id]);
  anat = { view, mode, queue: mode === 'explore' ? [] : shuffle(bones), idx: 0, correct: 0, done: false };
  renderAnatView();
}

function renderAnatView() {
  const v = VIEWS[anat.view];
  const total = anat.queue.length;
  const root = el(`<div>
    <header class="topbar">
      <div class="side"><button class="backbtn" id="back">&larr; Regions</button></div>
      <div class="center"><span class="topstat">${esc(v.label).toUpperCase()} &middot; ${anat.mode.toUpperCase()}</span></div>
      <div class="side right"><span class="topstat" id="ascore">${anat.mode === 'explore' ? '' : `0 / ${total}`}</span></div>
    </header>
    <main class="anat-stage">
      <div class="anat-prompt" id="prompt"></div>
      <div class="anat-figure ${v.type === 'image' ? 'is-image' : ''}">${figEl(v, true)}</div>
      <div class="anat-foot" id="foot"></div>
    </main>
  </div>`);
  root.querySelector('#back').addEventListener('click', renderAnatomy);

  const fig = root.querySelector('#fig');
  const exploreMode = anat.mode === 'explore';
  fig.querySelectorAll('.bone').forEach((b, i) => {
    b.setAttribute('tabindex', '0');
    b.setAttribute('role', 'button');
    const meta = BONE_META[b.dataset.bone];
    b.setAttribute('aria-label', exploreMode && meta ? meta.name : `Region ${i + 1}`);
    b.addEventListener('click', () => onBoneClick(b));
    b.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onBoneClick(b); } });
  });

  // hover name labels (Explore only — would spoil quizzes)
  if (anat.mode === 'explore') {
    const chip = el('<div class="bone-chip" style="display:none"></div>');
    root.appendChild(chip);
    fig.querySelectorAll('.bone').forEach(b => {
      b.addEventListener('mouseenter', () => { const m = BONE_META[b.dataset.bone]; if (m) { chip.textContent = m.name; chip.style.display = 'block'; } });
      b.addEventListener('mousemove', (e) => { chip.style.left = e.clientX + 'px'; chip.style.top = (e.clientY - 16) + 'px'; });
      b.addEventListener('mouseleave', () => { chip.style.display = 'none'; });
    });
  }

  setView(root);
  if (anat.mode === 'explore') setExplorePrompt();
  else nextQuiz();
}

function boneEls(id) { return [...document.querySelectorAll(`#fig .bone[data-bone="${id}"]`)]; }
function clearStates() { document.querySelectorAll('#fig .bone').forEach(b => b.classList.remove('correct', 'wrong', 'target', 'dim', 'found')); }

function setExplorePrompt() {
  document.getElementById('prompt').innerHTML = `<span class="anat-q">Explore</span><span class="anat-sub">Hover or click any structure.</span>`;
  document.getElementById('foot').innerHTML = '';
}

function onBoneClick(node) {
  const route = node.dataset.route;
  const id = node.dataset.bone;

  if (anat.mode === 'explore') {
    if (route && (!id || !BONE_META[id])) { startAnat(route, 'explore'); return; }
    clearStates();
    boneEls(id).forEach(e => e.classList.add('found'));
    showInfo(id, route);
    return;
  }
  if (anat.done) return;
  // quiz: find-it — must click the prompted bone
  if (anat.mode === 'find') {
    const target = anat.queue[anat.idx];
    if (route && !id) return;                 // ignore pure routing shapes during quiz
    const hit = id === target;
    if (hit) anat.correct++;
    boneEls(target).forEach(e => e.classList.add(hit ? 'correct' : 'target'));
    if (!hit && id) boneEls(id).forEach(e => e.classList.add('wrong'));
    lockAndAdvance(hit, target);
  }
}

function showInfo(id, route) {
  const m = BONE_META[id];
  const foot = document.getElementById('foot');
  if (!m) { foot.innerHTML = ''; return; }
  foot.innerHTML = `<div class="anat-info">
    <div class="ai-head"><span class="ai-name">${esc(m.name)}</span><span class="ai-latin">${esc(m.latin || '')}</span></div>
    <p class="ai-blurb">${esc(m.blurb || '')}</p>
    ${m.pearl ? `<p class="ai-pearl"><span>PEARL</span> ${esc(m.pearl)}</p>` : ''}
    ${route ? `<button class="btn ai-route" data-route="${route}">Open ${esc(VIEWS[route].label)} &rarr;</button>` : ''}
  </div>`;
  const rb = foot.querySelector('.ai-route');
  if (rb) rb.addEventListener('click', () => startAnat(route, 'explore'));
  document.getElementById('prompt').innerHTML = `<span class="anat-q">Explore</span><span class="anat-sub">Hover or click any structure.</span>`;
}

function nextQuiz() {
  clearStates();
  if (anat.idx >= anat.queue.length) { finishAnat(); return; }
  const id = anat.queue[anat.idx];
  const m = BONE_META[id];
  document.getElementById('foot').innerHTML = '';

  if (anat.mode === 'find') {
    document.getElementById('prompt').innerHTML = `<span class="anat-q">Find: <b>${esc(m.name)}</b></span><span class="anat-sub">Click it on the diagram.</span>`;
  } else { // name-it
    boneEls(id).forEach(e => e.classList.add('target'));
    document.querySelectorAll('#fig .bone').forEach(b => { if (b.dataset.bone !== id) b.classList.add('dim'); });
    const others = shuffle(VIEW_BONES[anat.view].filter(x => x !== id && BONE_META[x])).slice(0, 3);
    const opts = shuffle([id, ...others]);
    document.getElementById('prompt').innerHTML = `<span class="anat-q">Name the highlighted structure</span>`;
    const foot = document.getElementById('foot');
    foot.innerHTML = `<div class="anat-opts">${opts.map((o, i) => `<button class="opt" data-pick="${o}"><span class="key">${'ABCD'[i]}</span><span>${esc(BONE_META[o].name)}</span></button>`).join('')}</div>`;
    foot.querySelectorAll('.opt').forEach(b => b.addEventListener('click', () => pickName(b.dataset.pick, id)));
  }
}

function pickName(pick, id) {
  if (anat.done) return;
  const hit = pick === id;
  if (hit) anat.correct++;
  document.querySelectorAll('#fig .bone').forEach(b => b.classList.remove('dim'));
  boneEls(id).forEach(e => { e.classList.remove('target'); e.classList.add('correct'); });
  document.querySelectorAll('.anat-opts .opt').forEach(b => {
    b.disabled = true;
    if (b.dataset.pick === id) b.classList.add('correct');
    else if (b.dataset.pick === pick) b.classList.add('wrong');
  });
  lockAndAdvance(hit, id, true);
}

function lockAndAdvance(hit, id, keepOpts) {
  anat.idx++;
  const sc = document.getElementById('ascore');
  if (sc) sc.textContent = `${anat.correct} / ${anat.queue.length}`;
  const m = BONE_META[id];
  const foot = document.getElementById('foot');
  const verdict = `<div class="anat-verdict ${hit ? 'good' : 'bad'}">
    <span class="v-tag">${hit ? 'CORRECT' : 'ANSWER'}</span>
    <span class="v-name">${esc(m.name)}</span>
    ${m.pearl ? `<span class="v-pearl">${esc(m.pearl)}</span>` : ''}
    <button class="btn btn-solid" id="anext">${anat.idx >= anat.queue.length ? 'Results' : 'Next'} &rarr;</button>
  </div>`;
  if (keepOpts) foot.insertAdjacentHTML('beforeend', verdict);
  else foot.innerHTML = verdict;
  const nb = document.getElementById('anext');
  nb.addEventListener('click', nextQuiz);
  nb.focus();
}

function finishAnat() {
  anat.done = true;
  const total = anat.queue.length;
  const pct = Math.round(100 * anat.correct / total);
  // record best score for this region+mode; anatomy practice counts toward the daily streak
  if (!ANAT_STORE[anat.view]) ANAT_STORE[anat.view] = {};
  const prev = ANAT_STORE[anat.view][anat.mode] ?? -1;
  if (anat.correct > prev) ANAT_STORE[anat.view][anat.mode] = anat.correct;
  saveAnat();
  if (typeof bumpStreak === 'function') bumpStreak();
  clearStates();
  document.getElementById('prompt').innerHTML = '';
  document.getElementById('foot').innerHTML = `<div class="anat-results">
    <span class="label">${esc(VIEWS[anat.view].label)} &middot; ${anat.mode === 'find' ? 'Find it' : 'Name it'}</span>
    <div class="score">${String(anat.correct).padStart(2, '0')}<span class="of">/${String(total).padStart(2, '0')}</span></div>
    <div class="anat-pct">${pct}%</div>
    <div class="endbtns">
      <button class="btn btn-solid" id="again">Retry region</button>
      <button class="btn" id="explore2">Explore it</button>
      <button class="btn" id="regions">All regions</button>
    </div>
  </div>`;
  document.getElementById('again').addEventListener('click', () => startAnat(anat.view, anat.mode));
  document.getElementById('explore2').addEventListener('click', () => startAnat(anat.view, 'explore'));
  document.getElementById('regions').addEventListener('click', renderAnatomy);
}

window.renderAnatomy = renderAnatomy;
