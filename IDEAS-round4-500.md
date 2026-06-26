# Guitar Tuner - Round 4: 500 net-new ideas

> **Влито в ARCHITECTURE.md.** Выбранные высоковлияющие пункты (особенно архитектурные, типа course-aware tuning) перенесены в раздел "Selected High-Impact Expansions...". Полный сырой список — здесь для истории. Используй интегрированную версию в ARCHITECTURE.md.

Deduped against all 300 prior ideas. 500 ideas across 25 niches. Format: title - tier - Impact/Effort - note.

## Bowed & orchestral string instruments (20)

- **Per-string fifths-check mode for violin/viola/cello/bass** - P2 - H/M - Tune adjacent strings as pure 3:2 fifths, beat-rate readout.
- **Bowed-string preset bank GDAE/CGDA/CGDA-bass tunings** - P2 - H/L - Violin, viola, cello, 4/5-string bass standard fifths sets.
- **Double-bass fourths tuning EADG preset** - P3 - M/L - Orchestral bass tunes in fourths, not fifths; distinct table.
- **Scordatura preset library per piece** - P3 - M/M - Bach G-minor, Mahler, Saint-Saens Danse Macabre A-Eb.
- **Baroque vs modern A4 quick-toggle 415/430/440** - P2 - H/L - One-tap historical pitch standards instead of slider hunting.
- **Fine-tuner vs peg guidance by cents magnitude** - P2 - H/L - Coarse error says peg, small error says fine-tuner.
- **Wolf-tone frequency locator per cello/viola** - P3 - M/M - Sweep near F-F# on G string, flag wolf region.
- **Hardanger fiddle understrings sympathetic tuning sets** - P3 - M/M - Four/five resonance strings plus melody strings, named scordatura.
- **Viola d'amore 7-string sympathetic preset bank** - P4 - L/M - Common D-major sympathetic plus playing-string D-A-d-f#-a-d.'
- **Gut-string low-A reference (392-405 Hz)** - P3 - M/L - Historical gut setups want lower A than modern steel.
- **Sul-ponticello harmonic-check assist** - P4 - L/M - Verify natural harmonics align after tuning at the bridge.
- **Viol consort tunings treble/tenor/bass viol** - P3 - M/M - Fourths-and-third gamba tunings d-g-c-e-a-d per size.
- **Natural-harmonic target mode (5th/4th nodes)** - P3 - M/M - Tune by lightly-touched harmonics, expected pitch shown.
- **Open-string double-stop fifth interval trainer** - P3 - M/M - Ear-train bowed pure fifths across two adjacent strings.
- **Cello C-string low-end detection range extension** - P2 - H/M - Reliable f0 down to bass C1 32.7 Hz.
- **Bow-noise tolerant gating for sustained bowed tone** - P2 - H/M - Stable readout despite scratchy attack and bow changes.
- **Equal-tempered vs pure-fifths deviation display** - P3 - M/L - Show both ET target and beatless-fifth target cents.
- **Tailpiece fine-tuner turn estimate from cents** - P3 - M/L - Approximate eighth/quarter-turn suggestion per detected error.
- **5-string violin/viola hybrid CGDAE preset** - P4 - L/L - Fiddle/jazz five-string adds low C below G.
- **Octave-mandola and octave-violin orchestral tunings** - P4 - L/L - Lower-octave fifths instruments in string orchestras.

## Plucked world & folk string instruments (20)

- **Balalaika prima EEA unison-pair tuning preset** - P2 - H/L - Two unison E strings need adjacent same-target detection, not strings[0].
- **Domra-family GDA/EAD/bass tunings with low-range gate** - P2 - H/L - Three/four-string domra needs detection floor below guitar E2.
- **Course-aware Tuning model for paired-string instruments** - P1 - H/H - Add course grouping so bouzouki/laud/mandola octave pairs map correctly.
- **Greek bouzouki CFAD trichordo vs tetrachordo presets** - P3 - M/L - Distinct 3-course and 4-course bouzouki with octave-pair targets.
- **Tzouras and baglamas (Greek) octave-pair presets** - P3 - M/L - Smaller rebetiko instruments, baglamas sounds one octave high.
- **Saz/baglama bağlama düzeni and kara düzen tunings** - P3 - H/M - Multiple Turkish long-neck tunings with three string groups.
- **Microtonal fret-target overlay for saz/tar/setar** - P3 - H/H - Show non-12-TET fret comma offsets on detected open string.
- **Persian tar/setar CGCC-family course and drone tunings** - P3 - M/M - Setar four strings with paired chargah; tar double courses.
- **Komuz-style free-frequency kemençe (Black Sea) tuning sets** - P4 - M/L - Pontic lyra fifths/fourths variants, bowed three-string targets.
- **Venezuelan cuatro ADF#B reentrant tuning with reentrant flag** - P2 - H/M - Third string is lowest; needle order must not assume ascending.
- **Cuban tres GG-CC-EE octave-doubled course preset** - P3 - M/L - Three courses, mixed octave/unison doublings per course.
- **Puerto Rican cuatro five-course BEADG-style preset** - P3 - M/M - Ten strings in five octave/unison courses, wide range.
- **Cavaquinho DGBD and GCEA Brazilian/Portuguese tunings** - P3 - M/L - Four-string high-pitched, samba DGBD vs Portuguese variants.
- **Charango variant pack: standard, walaycho, ronroco** - P3 - H/M - Five courses GCEAE with the famous octave-split middle course.
- **Charango octave-split course detection for middle course** - P3 - H/M - Middle E course has one string an octave up; match both.
- **Cittern and octave mandolin GDAE/GDAD pentachord presets** - P3 - M/L - Five-course cittern and 8-string octave mandolin fifths tunings.
- **Mandola/mandocello CGDA fifths tunings with low gate** - P3 - M/L - Mandocello drops to C2; extend detection floor accordingly.
- **Greek/Cypriot laouto (laud) CFAD octave-course preset** - P3 - M/M - Four courses, low courses octave-paired, long scale.
- **Chinese pipa ADEA tuning with high-A4+ detection ceiling** - P3 - M/M - Four silk/nylon strings; raise upper detection bound above guitar.
- **Ruan (zhongruan/daruan) GDGD and ADAE fifths/fourths tunings** - P4 - M/L - Four-string moon lute, multiple regional tuning conventions.

## Keyed & free-reed instruments (20)

- **Piano 88-key sectioned tuning map A0-C8** - P3 - H/H - Visual keyboard split into bass/temperament/treble tuning sections
- **Equal-tempered piano stretch tuning curve (Railsback)** - P3 - H/H - Inharmonicity-driven octave stretch targets across the 88 keys
- **Set-the-temperament octave F3-F4 guided beat-rate aid** - P3 - H/M - Classic aural temperament: target beat rates per interval
- **Piano unison-trio tuning (3 strings per note)** - P3 - H/M - Detect and zero beating between same-note unison strings
- **Accordion reed-bank register selector (LMMH)** - P3 - H/M - Pick which reed rank you tune: low, mid, high
- **Accordion musette tremolo cents-offset target (dry/wet)** - P3 - H/M - Set deliberate detune between paired reeds for swing
- **Push/pull bisonoric reed pair tuning workflow** - P3 - M/M - Concertina/bandoneon: separate press and draw reed targets
- **Harmonica per-hole blow/draw target by key** - P3 - H/M - 10-hole diatonic layout, blow and draw notes per key
- **Harmonica compromise-tuning presets (just/ET/19-limit)** - P4 - M/M - Richter chord-vs-melody temperament offsets per hole
- **Overblow/overdraw target notes for harmonica players** - P4 - M/L - Show bent and overblow pitches per hole position
- **Harpsichord temperament library (Werckmeister, Vallotti, meantone)** - P3 - H/M - Historical unequal temperaments with per-note cents tables
- **Harpsichord quill-string single-choir tuning sequence** - P3 - M/M - Tune 8' rank first, then unison the 4' choir
- **Clavichord fret-pair shared-string tuning warning** - P4 - M/L - Flag notes sharing one string on fretted clavichords
- **Reed-organ stop-rank pitch reference per division** - P3 - M/M - Harmonium 8'/4'/16' rank targets, account for pressure drift
- **Melodica full-range note map with breath-pressure note** - P4 - M/L - Chromatic keyboard layout, warn pitch rises with harder blow
- **Celesta metal-bar pitch verification grid** - P4 - L/L - Fixed-pitch struck bars, flag bars drifted from ET
- **Toy-piano rod chromatic-deviation checker** - P4 - L/L - Map toy-piano metal rods, show wide off-ET tolerance
- **Glass harmonica bowl water-level tuning assistant** - P4 - L/M - Detect bowl pitch, advise water add/remove direction
- **Single reed vs sounded-reference beat-rate meter** - P3 - H/M - Play reference tone, show beats-per-second against tuned reed
- **Reed-filing direction hint (tip vs base)** - P3 - M/L - Sharp: file tip to lower; flat: file base to raise

## Tuned & mallet percussion (20)

- **Timpani head-tension lug map by clock position** - P3 - H/M - Live cents per lug bolt around 24/26/29/32-inch drum heads.
- **Timpani pedal-range pitch sweep guide (low to high)** - P3 - M/M - Mark per-drum fundamental ranges, warn outside Bb1-F4 limits.
- **Handpan scale presets: Kurd, Celtic, Hijaz, Pygmy** - P3 - H/L - Ding plus 8-9 tone fields, per-note target frequencies.
- **Handpan harmonic-triad check octave+fifth per tone field** - P4 - H/H - Verify fundamental, octave, compound-fifth alignment for each note.
- **Steelpan note-layout diagram tap-to-target (tenor/double-second)** - P4 - H/H - Circle-of-fifths pan layout, tap a note to tune.
- **Marimba/xylophone bar fundamental + overtone ratio check** - P3 - H/H - Verify rosewood bar tuned 1:4:10 fundamental-octave-twelfth ratios.
- **Vibraphone bar pitch check with sustain-pedal dampening note** - P3 - M/M - Long-decay aluminum bars; gate detection on stable sustain window.
- **Glockenspiel/orchestra-bells high-register A6-C8 detection mode** - P3 - M/M - Extend tau range and gate for very high bright partials.
- **Kalimba/mbira tine layout tuning by physical position** - P3 - H/M - Center-out alternating tine map, 17-key and Array presets.
- **Kalimba tine length-adjust hint (sharp=pull out, flat=push in)** - P3 - H/L - Directional instruction tied to cents sign for tine bridge.
- **Singing-bowl fundamental + beat-frequency rim/strike analysis** - P4 - M/H - Track inharmonic partials and audible beating between two modes.
- **Gong sustained-spectrum slow-attack detection (no transient gate)** - P3 - M/M - Long bloom; widen analysis window for shimmering inharmonic wash.
- **Tubular-bells strike-note vs hum-note disambiguation** - P4 - M/H - Perceived pitch is missing fundamental from partial ratios; flag it.
- **Crotales (antique cymbals) C6-C8 two-octave chromatic mode** - P4 - L/M - Bright bronze discs; high-register chromatic target set.
- **Inharmonicity-tolerant mallet detection profile (struck idiophones)** - P3 - H/H - Percussion partials are stretched; relax harmonic-lock for bars/bells.
- **Strike-decay-aware reading: capture pitch at attack settle** - P3 - H/M - Sample 50-200ms post-strike, ignore transient and final detune.
- **Glass/crystal-glasses tuning by water-level fill hint** - P4 - L/L - Sharp=remove water, flat=add; per-glass target frequencies.
- **Steel-tongue-drum scale presets (Akebono, Pygmy, major)** - P3 - M/L - Tongue layout map with per-tongue target notes.
- **Hang/handpan ding-to-gu fundamental and resonance check** - P4 - M/M - Verify bottom port Helmholtz gu pitch against ding octave.
- **Multi-strike averaging for percussion (median of N hits)** - P3 - H/M - Aggregate several mallet strikes to stabilize bar/bell cents.

## Drum & membrane tuning (20)

- **Per-lug pitch map heat ring around drumhead** - P3 - H/H - Tap each lug, plot detected pitch on circular SVG ring
- **Lug-to-lug deviation alert with worst-offender callout** - P3 - H/M - Flag the lug furthest from head mean in cents
- **Tom fundamental-interval preset packs (4ths, 5ths, octaves)** - P3 - H/L - Preset target pitches for 2/3/4-tom kits with intervals
- **Resonant vs batter head interval calculator** - P3 - H/M - Set reso pitch relative to batter for sustain/pitch-bend
- **Snare batter target presets by depth/material** - P4 - M/L - Curated tension targets for 5x14 wood vs metal snares
- **Kick fundamental target with low-frequency detection range** - P3 - H/M - Extend f0 search down to 40-90Hz for kick fundamentals
- **Drum clearing workflow: detune then even-tension guide** - P3 - H/M - Step sequence to seat head, finger-tight, then equalize lugs
- **Star-pattern lug sequence overlay for tightening order** - P4 - M/L - Highlight next lug in crisscross order during tuning
- **Tension-rod turn estimator from cents gap** - P4 - M/M - Suggest approximate quarter-turns to close pitch gap per lug
- **Replace contact-mic tuner: tap-detect mode short window** - P3 - H/H - Fast onset-gated detection sized for percussive head taps
- **Single-lug isolation mode dampen-rest-of-head prompt** - P4 - M/L - Guide muffling other lugs to read one cleanly
- **Drum head fundamental vs overtone separation readout** - P3 - H/H - Show f0 plus first overtone ratio for membrane modes
- **Whole-kit tuning profile save/recall per drum** - P3 - H/M - Store per-drum lug targets, recall before gigs
- **Pitch-map ring before/after comparison snapshot** - P4 - M/M - Overlay previous ring to show tuning improvement
- **Decay-time measurement per lug for even sustain** - P4 - M/H - Track note decay envelope to balance head damping
- **Timpani pedal-range tuning targets by drum size** - P4 - M/M - Per-kettle pitch ranges for 23/26/29/32-inch timpani
- **Drum mode toggle hides guitar strings, shows lug grid** - P2 - H/M - Distinct UI surface for membrane tuning vs string tuning
- **Lug count selector 5/6/8/10-lug head layouts** - P3 - H/L - Configure ring positions to match physical lug count
- **Batter pitch-bend preview from reso interval choice** - P4 - M/M - Sonify resulting attack pitch glide for chosen reso offset
- **Genre drum-tuning collections jazz/rock/metal targets** - P4 - M/L - Curated fundamental sets per style and kit size

## Wind & brass intonation (20)

- **Trumpet 1+3 / 1+2+3 valve sharpness compensation slide hints** - P3 - H/M - Show live cents and how far to extend third-valve slide.
- **Per-note tendency chart overlay for flute** - P3 - H/M - Mark known sharp/flat partials per fingering against detected pitch.
- **Transposing-instrument display toggle Bb/Eb/F** - P2 - H/M - Show written note for clarinet/sax/horn while detecting concert pitch.
- **Tuning-slide push/pull guidance in millimeters** - P3 - M/M - Convert detected cents offset to estimated slide-length adjustment.
- **Brass harmonic-series tendency overlay on detected partial** - P3 - H/M - Flag flat 5th and sharp 11th natural partials live.
- **Long-tone intonation-hold scoring with drift graph** - P3 - H/M - Score steadiness over a sustained note, plot cents over seconds.
- **Embouchure-drift trainer across a held crescendo** - P3 - M/M - Track pitch bend as dynamics change, warn on collapse.
- **Recorder / tin-whistle thumb-octave fingering presets** - P3 - M/L - Add D/C whistle and soprano recorder note ranges and tendencies.
- **Trombone slide-position tuning map per partial** - P3 - H/M - Show ideal slide position offset for detected note and partial.
- **Saxophone palm-key and low-note tendency presets** - P3 - M/L - Flag sharp palm keys and flat low-Bb register live.
- **French horn hand-stopping pitch-correction calculator** - P4 - M/M - Show semitone-up shift from stopping and target open pitch.
- **Reed-and-mouthpiece warm-up pitch-stability drift meter** - P3 - M/L - Track how cold-to-warm instrument pitch rises over minutes.
- **Oboe / bassoon double-reed crow-pitch reference check** - P4 - L/L - Verify reed crows near target before assembly tuning.
- **Concert-pitch vs written-pitch dual readout for ensembles** - P2 - H/M - Display both names simultaneously for transposing players.
- **Valve-combination intonation table for tuba/euphonium** - P3 - M/M - Per-fingering sharpness chart including 4th-valve compensation.
- **Lip-bend trainer: hit target cents by ear alone** - P3 - M/M - Hide needle, ask player to bend held note to target.
- **Clarinet register-break intonation comparison drill** - P3 - M/M - Compare same note chalumeau vs clarion, flag the gap.
- **Wind warm-up tuning-note routine A/Bb/concert-F sequence** - P3 - M/L - Guided band warm-up through standard ensemble tuning notes.
- **Difference-tone / beat-rate visualizer against reference drone** - P4 - H/H - Show beating against sustained reference for unison wind tuning.
- **Per-partial inharmonicity-free brass octave-lock indicator** - P3 - M/M - Confirm 2nd-partial octave matches fundamental cleanly.

## Vocal pitch training (non-detection-algorithm) (20)

- **Vocal range finder: capture lowest and highest note** - P2 - H/M - Sustained-note capture logs comfortable low/high bounds to profile.
- **Register-break marker on ascending glide** - P3 - H/M - Detect timbre/amplitude jump to flag chest-to-head passaggio note.
- **Pitch-match warmup drill: lip-trill on held target** - P2 - H/M - Play sine, sing match, score cents error over duration.
- **Sustained-note steadiness meter (cents standard deviation)** - P2 - H/L - Live wobble gauge from rolling f0 variance during one held note.
- **Interval-singing targets: hear root, sing fifth** - P3 - H/M - Prompt named interval above reference, grade landed semitone+cents.
- **Choir section reference: SATB part-tone selector** - P3 - M/L - Quick presets to drone your section's note at A4.
- **Falsetto threshold log over sessions** - P4 - M/M - Record highest modal vs falsetto crossover, trend the boundary.
- **Breath-supported steadiness streak counter** - P3 - M/M - Reward consecutive seconds within tolerance, reset on drift spike.
- **Five-tone siren warmup with live target track** - P3 - H/M - Guided 1-2-3-2-1 scale, needle follows expected note path.
- **Onset accuracy: how flat you start a note** - P3 - M/L - Measure cents error in first 200ms before settling.
- **Scoop and slide detector for clean attacks** - P4 - M/M - Flag pitch scooping from below target on note onset.
- **Vibrato rate and depth readout (Hz, cents)** - P3 - M/M - Analyze f0 oscillation to report vibrato speed and width.
- **Straight-tone trainer: suppress vibrato challenge** - P4 - M/L - Reward holding flat line, penalize oscillation above threshold.
- **Octave-leap accuracy drill** - P3 - M/L - Sing octave above given note, grade landed pitch.
- **Drone-against-scale intonation practice** - P3 - M/M - Hold tonic drone, sing scale degrees, show cents per step.
- **Comfortable tessitura heatmap from session history** - P4 - M/M - Color notes by accuracy to reveal your strong vocal zone.
- **Pitch-glide smoothness score on portamento** - P4 - L/M - Grade evenness of a continuous slide between two targets.
- **Call-and-response melodic phrase echo** - P3 - M/M - App plays 3-note phrase, you sing back, match scored.
- **Sharp-singer bias indicator across a session** - P3 - M/L - Aggregate mean cents offset to surface chronic sharp/flat tendency.
- **Held-note duration goal with steadiness gate** - P4 - M/L - Target seconds only count while within cents tolerance.

## Deep studio-engineering workflows (20)

- **Reamp re-tune A/B delta check against pre-print snapshot** - P3 - H/M - Compare guitar tuning before and after reamp pass, flag drift.
- **Per-track tuning report across imported multitrack stems** - P3 - H/H - Drop WAV stems, get per-stem detected tuning and cents table.
- **Comp-take tuning annotations keyed to take number** - P3 - M/M - Tag each comp take with its open-string tuning fingerprint.
- **Click/tempo-map sync of timed tuning checkpoints** - P4 - M/H - Schedule tuning verification at bar markers from imported tempo map.
- **Session template with required-tuning gate before record-arm** - P3 - H/M - Block session start until guitar matches template-mandated tuning.
- **Double-tracking consistency check L vs R guitar** - P3 - H/M - Verify both rhythm passes share identical per-string offsets.
- **Mix-bus tuning sanity pass on rendered bounce** - P4 - M/H - Scan final mix for global pitch-reference drift versus A4.
- **Take-boundary tuning markers exported as WAV cue chunk** - P4 - M/M - Embed tuning-pass markers into bounce as broadcast WAV cues.
- **Between-take drift logger across a tracking session** - P3 - H/M - Auto-capture open-string tuning each time recording stops.
- **Capo-position reconciliation report for layered parts** - P4 - M/M - Detect mismatched capo fret across stacked rhythm/lead tracks.
- **Per-string offset profile saved as session tuning preset** - P3 - M/L - Snapshot exact measured cents per string, recall next day.
- **Punch-in tuning verification before overdub region** - P3 - H/M - Quick gate confirming guitar matches the region being punched.
- **DI vs mic'd-amp tuning agreement cross-check** - P4 - M/M - Confirm DI track and amp track report same detected pitches.
- **Tuning continuity diff between tracking-day sessions** - P3 - H/M - Compare today's reference snapshot against last session's saved profile.
- **Stem-render tuning manifest sidecar JSON** - P4 - M/M - Emit per-stem tuning metadata file alongside delivered renders.
- **Overdub stack tuning-coherence score for layered guitars** - P4 - H/H - Aggregate cents spread across all stacked takes into one score.
- **Re-amp signal-chain tuning passthrough verification** - P4 - M/M - Confirm reamp box and converters introduce no pitch shift.
- **Required-tuning gate enforced per song in setlist render** - P3 - M/M - Each batch-render song carries its own mandated tuning check.
- **Tracking-session header report with date, A4, tuning baseline** - P3 - M/L - One-page session sheet stamping reference pitch and guitar tuning.
- **Detected-tuning watermark burned into reference render** - P4 - L/M - Annotate exported reference tone file with the tuning baseline used.

## Deep live-performance workflows (20)

- **Routed IEM monitor send for reference tone** - P4 - H/H - Pick output device, feed quiet reference into in-ear monitor channel.
- **Tuner-out passthrough: mute audio while detecting** - P3 - H/M - Emulate pedalboard tuner-out by gating output during tune.
- **Stage-blackout one-hand mode: giant edge tap zones** - P3 - H/M - Full-screen left/right halves advance string, no precise targets.
- **Song-change cue: pre-load next tuning at countdown** - P3 - H/M - Trigger tuning swap from a timed setlist position cue.
- **Guitar-tech instrument queue of pending tune jobs** - P4 - H/H - Tech queues multiple guitars, each with its target tuning.
- **Backup-guitar quick-match to primary's measured pitch** - P3 - H/M - Capture primary open-string readings, match spare to those cents.
- **Silent between-song mode: vibrate-only, screen dimmed** - P3 - H/L - No audio reference, haptic-only confirmation for quiet tuning.
- **Festival shared concert pitch via local LAN code** - P4 - H/H - Backstage host broadcasts A4 over LAN; players join by code.
- **Foot-stomp gesture advances string hands-free** - P4 - M/M - Phone on mic stand detects stomp to step strings.
- **Setlist tuning timeline scrollable per-song view** - P3 - M/M - Visualize whole show's tunings, jump to any song's setup.
- **Drop-tune delta: cents-to-detune for low string** - P3 - M/L - Show how far to slacken E to D for next song.
- **Loud-stage noise-aware confidence floor** - P3 - H/M - Adapt gating thresholds for ambient stage roar between songs.
- **Single-string isolation: lock detection to one target** - P3 - M/L - Ignore other strings when tech tunes one string fast.
- **Pre-show checklist: all strings green before set** - P3 - M/L - Confirm every open string in tune before walking onstage.
- **Encore re-tune recall restores last tuning** - P4 - M/L - One tap returns to tuning used before encore break.
- **Tech tablet mirror of player's live tuner state** - P4 - M/H - Side-stage tech screen mirrors performer's detection readout.
- **Per-song A4 override embedded in setlist entries** - P3 - M/L - A song needing 442 carries its own A4 value.
- **Quiet-confirm chime routed only to IEM** - P4 - M/H - In-tune cue plays into monitor mix, inaudible to audience.
- **String-break recovery jumps to broken string target** - P3 - M/L - After restringing mid-set, fast-tune just the replaced string.
- **Hold-to-tune latch pins display while glancing away** - P4 - M/L - Freeze last reading so tech reads after string stops.

## Deep teaching & classroom tools (20)

- **Local class roster with per-student tuning profiles** - P2 - H/M - IndexedDB roster keyed by student, switchable instrument and A4.
- **Assignment builder: target tuning plus accuracy goal** - P2 - H/M - Teacher sets tuning, max cents tolerance, time-to-tune target.
- **Exam mode: scored tuning challenge with locked feedback** - P3 - H/M - Hide cents readout, score final attempt against rubric thresholds.
- **Grading rubric editor mapping cents bands to letter grades** - P3 - M/L - Teacher defines A/B/C cents windows; auto-grade attempts.
- **Per-student practice-homework streak with assigned daily goal** - P3 - M/M - Local streak counter tied to roster, not single device.
- **Group exercise mode: simultaneous countdown tune-all** - P3 - H/M - Teacher screen counts down, students tune together to checkpoint.
- **Student progress dashboard with per-string accuracy over weeks** - P3 - H/H - Local timeline charting drift, time-to-tune, attempt counts.
- **Lesson-plan builder sequencing tuning drills into steps** - P3 - M/M - Ordered drill cards: open strings, alternate tuning, ear-check.
- **Seating chart mapping desks to student instrument profiles** - P4 - M/M - Grid layout teacher taps a seat to load that tuning.
- **Remote tuning-check submission via exported signed result file** - P4 - M/H - Student exports tamper-evident attempt JSON; teacher imports to grade.
- **Quiz mode: identify the mistuned string by ear** - P3 - H/M - Play detuned open chord, student picks which string is off.
- **Class leaderboard ranking by average time-to-in-tune** - P4 - M/L - Local-only roster ranking, opt-in, resettable per term.
- **Teacher passcode-locked settings to freeze exam parameters** - P3 - M/L - PIN gates A4, tolerance, mode so students cannot cheat.
- **Printable per-student progress report PDF for parents** - P4 - M/M - Term summary: streak, accuracy trend, assignments completed.
- **Assignment deadline reminder with completion checklist per student** - P4 - M/L - Local due-date list; mark each roster entry done.
- **Differentiated tolerance per student skill level** - P3 - M/L - Beginners get wider cents window; advanced tighter, set per roster.
- **Drill: tune blindfolded then reveal cents grade** - P3 - M/L - Classroom self-test, hidden meter, scored reveal on stop.
- **Bulk roster import/export via CSV for class setup** - P3 - M/L - Teacher pastes names, assigns instrument and tuning columns.
- **Sectional mode: filter roster by instrument section** - P4 - L/L - Show only guitar section students for ensemble tuning rounds.
- **Per-exercise attempt log with retry-count cap** - P3 - M/M - Limit attempts during exam; log each cents result locally.

## Kids mode & gamification mechanics (20)

- **Tuney the tuning-fork mascot reacts to cents error** - P3 - H/M - SVG sprite wobbles flat/sharp, smiles when string lands in tune
- **Six-string rescue quest: free each trapped string note** - P4 - H/H - Story map, tuning each string unlocks next scene panel
- **Animal-per-string mascots: low E bear to high E bird** - P3 - M/M - Each open string has a creature that hums its pitch
- **Sticker album grid filled by in-tune events** - P3 - H/M - Persistent IndexedDB album, one sticker per perfectly tuned string
- **XP awarded per string within cents tolerance** - P3 - H/L - Faster, steadier tuning grants more XP; shown as bar
- **Tuning ranks: Sprout, Strummer, String Wizard levels** - P3 - M/L - Level thresholds from accumulated XP, named child-friendly tiers
- **Daily challenge: tune all six before timer ends** - P3 - H/M - One seeded challenge per local date, completion badge
- **Tuning streak counter with streak-freeze token** - P3 - M/M - Consecutive days tracked; earned token skips one missed day
- **Parental PIN gate over settings and time stats** - P2 - H/M - 4-digit PIN hides A4/tuning edits, shows play-time totals
- **Daily play-time limit with gentle wind-down screen** - P3 - M/M - Parent-set minutes, mascot says bedtime, locks until tomorrow
- **Kids mode toggle: oversized 56px+ string buttons** - P3 - H/L - Big touch targets, fewer controls, hides advanced panels
- **Color-by-string game: match strummed string to its hue** - P3 - H/M - Detect played string, child taps matching colored pad
- **Reward chime built from the open-string chord** - P4 - M/L - Reuse sine engine to play a happy arpeggio on success
- **Confetti bloom and mascot cheer on six-string completion** - P4 - M/L - CSS particle burst when all strings tuned in session
- **Local-profile leaderboard ranked by tuning accuracy** - P3 - M/M - Compares saved family profiles by best time-to-in-tune
- **Avatar picker: choose mascot color and hat** - P4 - L/L - Per-profile customization unlocked by leveling up
- **Sound-the-animal ear game: pick string that matches hum** - P3 - M/M - Mascot hums a pitch, child selects matching open string
- **Treasure-chest reward: random sticker on streak milestone** - P4 - M/L - Animated chest opens at 3/7/30-day streaks
- **Star rating per string: 1-3 stars by tuning precision** - P3 - M/L - Tighter cents window earns more stars, drives replay
- **Progress garden grows a plant per practice day** - P4 - L/M - Visual streak metaphor; flower blooms as days accumulate

## Specific data visualizations (20)

- **Lissajous phase figure: mic signal vs reference sine** - P3 - H/M - Rotating ellipse freezes still when string matches reference frequency.
- **Polar pitch wheel with 12 semitone spokes** - P3 - M/M - Detected note as rotating arm; cents push off-spoke radially.
- **Cents waterfall: scrolling per-frame deviation history band** - P3 - H/M - Vertical scroll of cents-colored rows shows pluck decay drift.
- **Pitch constellation scatter: cents vs amplitude points** - P4 - M/M - Each frame a dot; cluster tightness signals tuning stability.
- **Cents sparkline mini-history under note readout** - P3 - H/L - Tiny 3-second inline trace shows whether pitch is settling.
- **Chromagram: 12-bin pitch-class energy bar ring** - P4 - M/M - Folds spectrum into pitch classes; confirms fundamental over harmonics.
- **Session timeline scrubber over recorded tuning attempt** - P4 - M/H - Drag playhead across a stored cents-vs-time curve per string.
- **Six-string radial gauge cluster, hexagon arrangement** - P3 - H/M - All EADGBE mini needles at once for whole-guitar glance.
- **3D rotating spectrum ribbon, time-depth axis** - P4 - L/H - Spectral slices recede in depth; harmonics form ridges.
- **Error-distribution violin plot per string over session** - P4 - M/M - Shows cents spread shape, not just mean, per string.
- **Harmonic stack ladder: partial deviations vs ideal integers** - P4 - M/M - Visualizes string inharmonicity as drift up the overtone ladder.
- **Beat-frequency envelope meter vs reference tone** - P3 - H/L - Pulsing amplitude bar; beat rate slows to zero at unison.
- **Cents bullseye: concentric tolerance rings with live dot** - P3 - H/L - Dot homes into green center ring as pitch nears target.
- **Pitch trajectory comet: fading trail of recent f0** - P4 - M/L - Comet tail shows attack glide direction toward target line.
- **Per-string drift heat-strip stacked timeline** - P4 - M/M - Six horizontal heat rows reveal which string slips fastest.
- **Confidence ribbon overlaid on cents trace** - P3 - M/L - Trace thickness or opacity encodes detection confidence per frame.
- **Spiral pitch map: octaves as turns, notes as angle** - P4 - L/M - Logarithmic spiral places detected pitch by octave and class.
- **Harmonic phase-clock dials for first three partials** - P4 - L/H - Three rotating hands stall together when fundamental locks in.
- **Stacked-area overtone balance over time** - P4 - M/M - Shows tone brightening or dulling as string decays.
- **Cents histogram building live during a hold** - P3 - M/L - Bars accumulate; symmetric narrow peak means stable in-tune hold.

## Micro UI components & interactions (20)

- **Long-press a string opens reference-tone sustain menu** - P3 - H/M - Hold string to ring sustained pitch, release stops.
- **Swipe horizontally on tuner panel to cycle tunings** - P3 - H/M - Touch swipe steps prev/next tuning with edge bounce.
- **Press-and-hold +/- A4 stepper auto-repeats with acceleration** - P3 - M/L - Hold accelerates Hz steps; tap nudges single increment.
- **Inline-edit string note via tap-to-spin chromatic picker** - P3 - H/M - Tap string label, scroll wheel to reassign note.
- **Drag-reorder strings to reverse for left-handed display** - P3 - M/M - Vertical drag handle reorders string list, persists.
- **Right-click string context menu: set reference, mute, edit** - P3 - M/M - Desktop context menu per string row with actions.
- **Command palette (Cmd/Ctrl-K) for tunings and settings** - P3 - H/M - Fuzzy-search tunings, A4 presets, modes from one input.
- **Undo/redo stack for tuning and A4 changes** - P3 - M/M - Ctrl-Z reverts last tuning/A4/string edit; redo forward.
- **Bottom-sheet tuning picker on mobile with snap points** - P3 - H/M - Swipe-up sheet lists tunings, half/full detents.
- **Segmented control for detection mode guitar/chromatic/strobe** - P3 - M/L - Sliding pill toggle replaces dropdown for modes.
- **Toast confirming tuning switch with one-tap undo** - P4 - M/L - Transient toast: 'Drop D' with inline undo button.
- **Hover popover on string shows target Hz and cents** - P4 - L/L - Desktop tooltip surfaces exact frequency per string.
- **A4 number-stepper with scroll-wheel and arrow-key nudge** - P3 - M/L - Focus field, wheel/arrows adjust Hz within clamp range.
- **Double-tap a string to instantly select as target** - P4 - M/L - Quick gesture pins manual target without dropdown.
- **Two-finger swipe-down dismisses settings sidebar mobile** - P4 - L/L - Gesture closes panel matching native sheet feel.
- **Long-press A4 value resets to 440 with confirm** - P4 - L/L - Hold value, ripple confirms snap back to standard.
- **Drag A4 horizontal slider with magnetic 440 detent** - P3 - M/M - Slider snaps softly at 440 within fine drag range.
- **Keyboard string navigation with up/down and Enter select** - P3 - M/L - Arrow through strings, Enter sets manual target.
- **Radial long-press menu around string: tone, edit, octave** - P4 - M/H - Hold spawns arc of actions under finger.
- **Inline toast queue stacking with auto-dismiss timers** - P4 - L/M - Multiple notifications stack, oldest expires first.

## Power-user & keyboard control (20)

- **Quick-switch tuning palette (Ctrl+K command bar)** - P2 - H/M - Fuzzy-search overlay to jump to any tuning instantly
- **Fully remappable hotkey editor in settings** - P2 - H/M - Per-action key capture stored in localStorage, conflict detection
- **Keyboard cheat-sheet overlay bound to '?'** - P3 - M/L - Modal listing all active shortcuts contextually
- **Vim hjkl string and setting navigation** - P3 - M/M - j/k move string, h/l nudge A4, gg/G jump ends
- **Focus mode hiding all chrome (key 'f')** - P3 - M/L - Hide header/footer/sidebar, show only needle
- **URL query params preset tuning/A4/string state** - P2 - H/L - ?tuning=dadgad&a4=442&string=3 deep-links exact state
- **Setup macro recorder replaying tuning+A4+mode** - P4 - M/H - Record action sequence, replay as one named macro
- **Number-key direct string selection 1-6** - P2 - H/L - Press digit to target that string immediately
- **Radial quick-action wheel on long-press space** - P4 - M/H - Mouse/key wheel for tuning, mode, reference tone
- **Scriptable JSON config import/export file** - P3 - M/M - Declarative file defines hotkeys, tunings, defaults
- **Multi-key chord bindings (e.g. g then d)** - P3 - M/M - Sequential leader-key combos for rare actions
- **Leader-key timeout indicator HUD** - P4 - L/L - Show pending chord prefix and available next keys
- **Hotkey to cycle reference-tone through all strings** - P3 - M/L - Bracket keys step pitch-pipe up/down strings
- **Hold-to-sound reference tone while key down** - P3 - M/L - Momentary tone playback released on keyup
- **Command palette recent/favorites ordering** - P3 - M/M - Surface last-used tunings first in Ctrl+K list
- **egui native global keymap mirroring web bindings** - P3 - M/M - Shared keymap JSON consumed by egui input handler
- **Tab/Shift+Tab roving focus across all controls** - P2 - H/L - Logical focus order, visible focus ring everywhere
- **Spacebar toggles listening start/stop** - P2 - H/L - Single most-used action on most accessible key
- **'r' randomizes ear-training string via keyboard** - P4 - L/L - Trigger next random string without mouse
- **Hotkey profiles: switch QWERTY/Dvorak/custom sets** - P4 - L/M - Named binding profiles swapped from settings

## Settings & personalization depth (20)

- **Versioned settings schema with migration runner** - P1 - H/M - Stamp schemaVersion; migrate old keys on load, no data loss.
- **Export full config as downloadable tuner.json** - P2 - M/L - Serialize all keys including custom tunings to one file.
- **Import config JSON with validation and diff preview** - P2 - M/M - Validate against schema, show what changes before applying.
- **Named setting presets (Studio, Live, Practice)** - P2 - H/M - Save full settings snapshot under a name, switch instantly.
- **Per-device input profiles keyed by deviceId label** - P3 - H/M - Auto-load A4/tolerance/gate when a known mic reconnects.
- **Per-tuning default A4 override** - P3 - M/L - DADGAD remembers 442, standard stays 440 automatically.
- **Configurable in-tune tolerance band in cents** - P2 - H/L - Slider 1-10 cents controls green-zone width directly.
- **Units toggle: cents-only vs Hz-and-cents readout** - P3 - M/L - Hide Hz for beginners, show both for techs.
- **Remember-last-string per tuning** - P3 - L/L - Reopen on the string you last tuned in that tuning.
- **Reset-to-defaults scoped per settings section** - P3 - M/L - Reset only visualizers or only detection, not everything.
- **Advanced vs Simple settings disclosure split** - P3 - M/L - Hide gate/tolerance/range behind an Advanced toggle.
- **Settings search/filter box** - P3 - M/M - Type to jump to any control across all sections.
- **Settings dirty-state and discard-changes guard** - P4 - L/L - Warn before nav if unsaved manual edits exist.
- **Per-string custom in-tune tolerance overrides** - P3 - M/M - Tighter band on high E, looser on low E.
- **Settings change-history with undo stack** - P4 - L/M - Step back through recent setting edits this session.
- **Cloud-free settings sync via shareable text blob** - P4 - L/L - Base64 paste-string moves config between browser and native.
- **Default-startup-view setting (tuner/ear-trainer)** - P3 - L/L - Choose which mode opens on launch.
- **Settings JSON schema doc generated from TS types** - P4 - L/M - Single source describes every key for import validators.
- **Quarantine unknown keys on import, never silently drop** - P3 - M/L - Preserve forward-compat keys from newer app versions.
- **Preset auto-apply rule by connected device** - P4 - M/M - Bind a named preset to fire when a mic appears.

## Privacy & security depth (20)

- **Subresource Integrity hashes on WASM and JS bundles** - P2 - H/M - Vite plugin emits SRI digests; tamper-proof /tuner/ asset loads.
- **CSP report-only header then enforce wasm-unsafe-eval default-src self** - P2 - H/M - Stage report-only, collect violations, then enforce strict policy.
- **local CSP violation collector logging to in-app panel** - P3 - M/M - report-to endpoint writes violations locally, no external reporting URI.
- **AES-GCM encrypt persisted settings via WebCrypto and device key** - P4 - M/H - Encrypt tuning/A4/logs at rest with non-extractable IndexedDB key.
- **CI no-third-party-requests test blocking external fetch/connect** - P2 - H/M - Playwright fails build if any non-self network request fires.
- **CycloneDX SBOM generation for npm and Cargo dependencies** - P3 - M/L - Emit signed SBOM artifact per release for npm and crates.
- **SLSA provenance attestation for WASM and web bundle** - P4 - M/H - GitHub attest-build-provenance signs WASM/JS build artifacts.
- **Reproducible-build check diffing two independent WASM compiles** - P4 - M/H - CI rebuilds pitch-core WASM twice, asserts byte-identical output.
- **Permissions explainer page detailing microphone-only no-upload usage** - P3 - M/L - Static page explaining mic stays on-device, never transmitted.
- **Clear-all-local-data button wiping localStorage IndexedDB caches** - P2 - H/L - One click clears settings, logs, caches, revokes mic stream.
- **security.txt at well-known with contact and PGP** - P4 - L/L - Publish /tuner/.well-known/security.txt for vulnerability disclosure.
- **Threat-model doc STRIDE for mic audio and storage** - P3 - M/M - Document trust boundaries, attack surface, mitigations in repo.
- **Permissions-Policy header denying camera geolocation USB except microphone** - P3 - M/L - Lock down all browser features except needed microphone.
- **CI fail on disallowed WASM imports outside known namespace** - P3 - M/M - wasm-objdump asserts only env/webaudio imports, no surprise host calls.
- **Static asset hash manifest verified against version.json at load** - P3 - M/M - Runtime checks served bundle hashes match signed manifest.
- **Cross-Origin-Isolation COOP COEP headers for hardened context** - P3 - M/L - Enable crossOriginIsolated, gate future SharedArrayBuffer DSP safely.
- **Tauri capability allowlist audit removing unused command scopes** - P3 - M/M - Minimize Tauri v2 capabilities to mic and storage only.
- **egui native config file written with 0600 restrictive permissions** - P4 - L/L - Chmod app-data tuning config so other users cannot read.
- **Privacy regression snapshot of localStorage keys in CI** - P3 - M/L - Golden test fails if new persisted key appears unreviewed.
- **Dependency pinning by integrity hash plus lockfile-lint gate** - P3 - M/L - lockfile-lint enforces https resolved URLs and integrity present.

## Performance & bundle optimization (20)

- **Lazy-load Waveform and Spectrum via defineAsyncComponent** - P2 - H/L - App.vue statically imports both; split each into its own chunk.
- **Gate visualizer chunk fetch behind showWaveform/showSpectrum toggles** - P2 - H/L - Only download viz code when user enables that visualizer.
- **WASM streaming instantiation via instantiateStreaming for pitch-core** - P3 - M/M - When web wires WASM, compile-while-download instead of arrayBuffer fetch.
- **Brotli + gzip precompress dist with vite-plugin-compression** - P2 - H/L - Static GitHub Pages host can serve .br/.gz for JS/WASM/CSS.
- **manualChunks split vendor vue from app code** - P3 - M/L - Vue rarely changes; long-cache vendor chunk separate from app.
- **CI bundle-size budget gate on dist JS/WASM bytes** - P3 - M/M - Fail PR if main chunk or WASM exceeds set kB threshold.
- **Subset Tailwind font stack, drop unused system-ui fallbacks** - P4 - L/L - No custom font loaded; trim CSS and preconnect nothing.
- **Inline critical CSS, defer rest to cut first paint** - P3 - M/M - Extract above-fold tuner styles, async-load remainder.
- **Merge favicon.svg + icons.svg into one symbol sprite** - P4 - L/L - Two SVGs (14KB) become one cached <use> sprite request.
- **Frame-time budget guard skipping detection when over 16ms** - P3 - M/M - tick() drops a YIN pass on slow frames to hold 60fps.
- **Low-end-device mode: halve FFT_SIZE and viz FPS** - P3 - M/M - Detect deviceMemory/hardwareConcurrency, reduce 2048 buffer and redraw rate.
- **requestIdleCallback-defer settings/practice code past mic start** - P3 - M/L - Tuner core mounts first; defer TunerControls heavy logic.
- **Preallocate YIN buffers as module singletons across calls** - P4 - L/L - pitch.ts reallocates per size change; pin to max guitar size.
- **Decimate input to fixed 22050Hz before YIN loop** - P3 - M/M - Guitar max 400Hz needs no 44.1k; halves tau-search cost.
- **Cap maxTau by selected-string frequency to shorten YIN** - P3 - M/L - When string chosen, narrow lag range, fewer CMNDF iterations.
- **Reuse single Float32Array for RMS and YIN, no copy** - P4 - L/L - Share timeDomainBuffer; avoid second analyser read per frame.
- **Throttle visualizer redraw to 30fps decoupled from detection** - P3 - M/L - Waveform/Spectrum at 30fps saves canvas work, detection stays fast.
- **OffscreenCanvas spectrum compute off main thread, fallback main** - P4 - M/H - Move FFT-bin drawing to worker, free main for detection.
- **Cache Spectrum bar gradient and bin-x lookup tables** - P4 - L/L - Precompute bar geometry once per resize, not per frame.
- **Skip getByteFrequencyData when Spectrum component unmounted** - P3 - M/L - Stop analyser frequency reads entirely when spectrum hidden.

## Offline & storage depth (20)

- **IndexedDB tuning store replacing localStorage for packs** - P2 - H/M - Move custom tunings/packs from localStorage to structured IndexedDB store.
- **Versioned IndexedDB schema with onupgradeneeded migration ladder** - P2 - H/M - Sequential migration functions per schema version, idempotent and tested.
- **Storage-usage meter UI in settings sidebar** - P3 - M/L - navigator.storage.estimate() usage/quota bar with per-category breakdown.
- **Full backup export to single .tunerbackup JSON file** - P3 - H/L - Bundle tunings, A4, settings, stats into one downloadable file.
- **Backup restore with dry-run diff preview** - P3 - M/M - Show added/changed/removed entries before committing restore.
- **Cache-version manifest with stale-cache purge on boot** - P3 - M/L - Compare baked CACHE_VERSION, delete old caches.keys() entries at startup.
- **Periodic Background Sync refresh of community pack gallery** - P4 - M/M - periodicSync registration pulls updated curated pack index daily.
- **Background Sync queue for failed pack PR submissions** - P4 - L/M - Retry user pack submissions via SyncManager when back online.
- **Last-write-wins conflict resolution with timestamp tiebreak** - P3 - M/M - Per-pack updatedAt compares local vs synced, prompt on tie.
- **Three-way merge UI for divergent custom tunings** - P4 - M/H - Side-by-side resolve when local and remote pack both edited.
- **Quota-pressure handler degrading non-essential caches first** - P3 - M/M - On QuotaExceededError evict spectrogram caches before tuning data.
- **storage.persisted() request gated on engagement signal** - P3 - M/L - Request persistent storage after user saves first custom tuning.
- **Deferred beforeinstallprompt with contextual re-surface timing** - P3 - M/L - Stash event, show install CTA after second successful tune.
- **Soft-delete trash bin with 30-day pack recovery** - P4 - L/M - Tombstone deleted tunings in IndexedDB before permanent purge.
- **Per-pack content hash for sync change detection** - P3 - M/L - SHA of normalized pack JSON skips no-op rewrites and conflicts.
- **Backup schema-version field with forward-compat import guard** - P3 - M/L - Reject or migrate older/newer .tunerbackup versions with clear message.
- **Offline pack availability badge per gallery entry** - P4 - L/L - Mark which community packs are cached and usable offline.
- **IndexedDB blob store for cached pack thumbnails** - P4 - L/M - Store gallery artwork as blobs, evictable under quota pressure.
- **Migration rollback snapshot before each schema upgrade** - P3 - M/M - Export pre-migration backup so failed upgrade can revert.
- **Eviction warning when persisted-storage permission denied** - P3 - L/L - Banner noting data may be cleared under disk pressure.

## Productivity-app integrations (20)

- **Notion practice-log row append via internal integration token** - P3 - H/M - POST tuning session to Notion database; token in settings.
- **Obsidian daily-note append via Local REST API plugin** - P3 - M/M - PUT cents/drift summary to today's note over localhost.
- **Obsidian URI obsidian://new append for offline vaults** - P4 - M/L - Build obsidian:// link appending session without running server.
- **Google Sheets session export via Apps Script web app** - P3 - M/M - POST per-string cents rows to user's deployed Sheet endpoint.
- **Google Sheets append via Sheets API OAuth device flow** - P4 - M/H - Native OAuth appends rows; avoids server intermediary.
- **Apple Calendar practice reminder via generated .ics download** - P3 - M/L - Export VEVENT with VALARM for next practice session.
- **Google Calendar practice event via prefilled render URL** - P4 - M/L - Open calendar.google.com/render?action=TEMPLATE with session times.
- **Todoist quick-add task via REST v2 token** - P3 - M/M - Create 'restring guitar' task when drift trend detected.
- **Todoist add-task URL scheme todoist://addtask fallback** - P4 - L/L - Deep link prefilled task without storing API token.
- **Things add-to-inbox via things:///add x-callback URL** - P4 - L/L - Create restring/practice task in Things 3 on macOS/iOS.
- **Apple Shortcuts 'Start Tuning' action via app intent** - P4 - H/H - Expose Tauri-mobile intent so Siri/Shortcuts launches tuner.
- **Apple Shortcuts 'Get Last Session' returns cents JSON** - P4 - M/H - Shortcut reads last tuning summary for automation chains.
- **Raycast extension quick-tune launches PWA at string** - P3 - M/M - Raycast command opens /tuner/ deep-linked to target string.
- **Raycast 'Reference Tone' command plays selected pitch** - P4 - L/M - Trigger sine reference for one string from launcher.
- **Alfred workflow keyword 'tune' opens tuner standard tuning** - P4 - L/L - Alfred keyword launches PWA with tuning query param.
- **Home Assistant webhook fires on in-tune completion** - P3 - M/L - POST to HA webhook so practice-light automation triggers.
- **Home Assistant REST sensor exposes current cents value** - P4 - L/M - Serve local JSON sensor for dashboard 'currently tuning' state.
- **Apple Health mindful-minutes write per practice session** - P4 - M/H - Tauri-mobile HealthKit logs tuning time as mindful minutes.
- **IFTTT Webhooks trigger on session-complete event** - P3 - M/L - Fire maker.ifttt.com event with cents/duration ingredients.
- **Zapier Catch Hook posts structured session payload** - P3 - M/L - Send JSON to Zapier hook for arbitrary downstream automations.

## Music-app & content integrations (20)

- **Read tuning from imported Guitar Pro .gp/.gpx file** - P3 - H/M - Parse .gp track header, auto-select matching 6-string tuning.
- **Songsterr paste-link tuning extractor** - P3 - H/M - Paste Songsterr URL, fetch track tuning JSON, apply preset.
- **Ultimate-Guitar tab URL capo/tuning sniffer** - P3 - M/M - Read UG page tuning+capo line, suggest matching tuner setup.
- **Spotify track audio-features key to tuning hint** - P4 - M/M - Look up song key, suggest drop/standard tuning for jam.
- **Apple Music song-key lookup suggests playing tuning** - P4 - M/H - MusicKit key fetch maps to recommended guitar tuning.
- **YouTube play-along A/B loop alongside tuner panel** - P3 - H/M - Embed iframe, loop section, tune between takes seamlessly.
- **Moises stem-isolation deep link for tuning to track** - P4 - M/L - Open Moises guitar-removed stem, tune against original key.
- **Chordify chord-sheet key import suggests capo position** - P4 - M/M - Read Chordify song key, map to capo+tuning recommendation.
- **Soundslice embed with synced tuning preset** - P4 - M/M - Pair Soundslice player notation with the piece's tuning.
- **MuseScore .mscz key-signature reader suggests tuning** - P4 - M/M - Parse uploaded MuseScore key, recommend matching guitar tuning.
- **Setlist.fm setlist import builds tuning sequence** - P3 - H/M - Fetch setlist, order tunings per song for live switching.
- **Bandcamp track embed for ear-tune to release** - P4 - L/L - Embed Bandcamp player, tune to actual recorded reference.
- **MusicBrainz/AcoustID local fingerprint to song tuning DB** - P4 - M/H - Identify recording, look up community tuning annotation.
- **Drop-link bar: paste any tab URL, extract tuning** - P3 - H/M - Unified parser dispatching to Songsterr/UG/GP by host.
- **Guitar Pro tuning round-trip export to .gp5 header** - P4 - L/M - Write current custom tuning back into shareable .gp file.
- **Songsterr 'capo' field maps to in-app transpose** - P4 - M/L - Apply Songsterr capo value to reference-tone transpose offset.
- **YouTube chapter timestamps as per-section tuning cues** - P4 - M/H - Map video chapters to tuning changes for medley practice.
- **Soundslice slowdown control next to ear-training mode** - P4 - L/M - Practice riff slowed while tuner verifies open strings.
- **Spotify playlist scan suggests one tuning for whole set** - P4 - M/H - Aggregate playlist keys, recommend best single live tuning.
- **Local cache of song-to-tuning lookups (offline replay)** - P3 - M/L - Persist fetched tuning hints in IndexedDB, reuse offline.

## Content & growth (non-store) (20)

- **Per-tuning explainer article set: Drop D, DADGAD, Open G** - P3 - H/M - One deep page per tuning with notes, songs, history.
- **"How to tune a 12-string guitar" long-form guide** - P3 - M/M - Octave-pair tuning is a high-intent unanswered query.
- **Comparison page: Tuner vs GuitarTuna/Fender Tune** - P3 - H/M - Privacy/offline/free angle captures branded comparison search.
- **Public changelog page rendered from version.json** - P3 - M/L - Dated release notes build trust and fresh-content signals.
- **FAQ schema JSON-LD on landing page** - P3 - H/L - Rich-result eligibility for "is this tuner accurate" queries.
- **Glossary pages: cents, A4, harmonics, intonation** - P3 - M/M - Long-tail definitional pages internally linking to tuner.
- **Embeddable "Tuned with" badge for guitar blogs** - P4 - M/L - Backlink-generating HTML snippet pointing to /tuner/.
- **Press/media kit page: logo, screenshots, copy blurbs** - P4 - M/L - Lowers friction for bloggers and reviewers to feature.
- **Social share-card SVG templates per tuning result** - P4 - M/M - Brandable images for Reddit/forum tuning posts.
- **"Standard tuning notes EADGBE" cornerstone SEO page** - P3 - H/L - Targets the single highest-volume beginner guitar query.
- **Tutorial series: tune by ear without a tuner** - P3 - M/M - 5th-fret method article funnels to app as backup.
- **"Why does my guitar go out of tune" troubleshooting article** - P3 - M/M - High-intent maintenance query with strong app CTA.
- **Tuning frequency reference table page (Hz per string)** - P3 - M/L - Snippet-bait table for 82.41Hz E2 etc. queries.
- **Song-to-tuning index page (capo + tuning per song)** - P4 - M/H - Curated static map of popular songs to their tunings.
- **"Best A4 reference: 440 vs 432 vs 442" debate article** - P3 - M/M - Controversial topic drives shares and backlinks.
- **Reddit r/Guitar launch + AMA-style demo thread** - P3 - H/L - Privacy/offline angle resonates with that community.
- **YouTube short: 30-second offline-tuner demo** - P4 - M/M - Visual proof of accuracy for social distribution.
- **Email newsletter: monthly tuning tip + changelog** - P4 - L/M - Re-engagement channel; static signup, no backend needed.
- **breadcrumb + Article schema on all explainer pages** - P3 - M/L - Structured data lifts SERP presentation site-wide.
- **"Drop D vs Drop C vs Drop B" comparison cluster** - P3 - M/M - Metal-genre tuning cluster captures niche long-tail.

## Documentation & developer experience (20)

- **ADR for pitch-core as single-source DSP crate** - P1 - H/L - Record why YIN+MPM live in shared Rust, not duplicated per target.
- **ADR for Vite base '/tuner/' subpath constraint** - P2 - M/L - Document base-path coupling so contributors stop breaking asset URLs.
- **CONTRIBUTING.md with WASM build prerequisites** - P1 - H/L - List wasm-pack, Rust toolchain, npm steps before first run.
- **Three-target architecture diagram in README** - P2 - H/M - Mermaid graph: pitch-core feeding web, egui, Tauri.
- **Histoire/Storybook stories for the 10 Vue components** - P3 - H/H - Isolated CentsGauge, Waveform, Spectrum states without live mic.
- **Playwright E2E for mic-permission-denied flow** - P2 - H/M - Drive fake getUserMedia, assert permission UI path renders.
- **Playwright fake-WAV pipeline test asserts detected note** - P3 - H/H - Feed synthetic E2 audio, assert NoteDisplay shows E.
- **Visual-regression snapshots per CentsGauge needle angle** - P3 - M/M - Lock pixel output of gauge at -50/0/+50 cents.
- **commitlint config rejecting type: prefixes** - P3 - M/L - Enforce the repo's no-conventional-prefix subject convention in CI.
- **Pull request template with target-checklist** - P2 - M/L - Boxes for web/egui/Tauri tested and tuning-table parity.
- **Issue template for new tuning-preset submissions** - P3 - M/L - Structured form: strings, frequencies, source citation.
- **iframe widget embed API reference page** - P3 - H/M - Document postMessage events, allowed attributes, sizing contract.
- **Copy-paste iframe embed snippet generator page** - P4 - M/L - Interactive form emitting ready iframe HTML for sites.
- **Design-token reference page from Tailwind config** - P3 - M/M - Auto-render color/spacing tokens used across components.
- **useTuner composable lifecycle sequence diagram** - P3 - M/L - Document AudioContext start, detection loop, teardown ordering.
- **Local seed fixture: bundled reference tone WAVs** - P3 - M/L - Ship per-string sample files for mic-free dev iteration.
- **Dev mode synthetic-signal injector toggle** - P3 - H/M - Replace mic with generated f0 for deterministic local UI work.
- **ADR for keeping note math in two languages** - P3 - M/L - Explain Rust-TS duplication tradeoff vs single WASM source.
- **l10n contributor guide for adding string keys** - P3 - M/L - Document l10n.ts structure and RU/EN key parity rules.
- **JSDoc on pitch.ts and notes.ts public functions** - P3 - M/L - Document frequencyToNote, cents math signatures and edge cases.

## Theming & visual identity depth (20)

- **Extract semantic color tokens from hardcoded hex** - P1 - H/M - CSS custom properties layer enabling all theming work in style.css.
- **OLED true-black theme with pure #000 surfaces** - P3 - M/L - Saves AMOLED power; cards become #000, borders dim gray.
- **High-contrast pro theme for bright-stage readability** - P2 - H/M - Max luminance separation on note-letter, gauge, cents bar.
- **Sepia warm low-blue-light reading variant** - P4 - L/L - Amber-tinted surfaces for late-night practice eye comfort.
- **Custom accent picker from a color wheel** - P3 - M/M - Replace fixed #22c55e green across buttons, gauge, strings.
- **Extract accent palette from uploaded album art** - P4 - M/H - Canvas k-means on cover image seeds accent and surface hues.
- **Per-instrument auto-theme keyed to selected tuning** - P3 - M/M - Acoustic warm-wood vs metal cold-steel palette per preset.
- **Illustrated empty-state art for idle/no-signal** - P3 - M/M - SVG sleeping headstock replaces bare idle text states.
- **Animated tuning-fork logo with listening/locked states** - P3 - M/M - Tine vibrates while listening, settles when in tune.
- **Swappable icon-set variants outline/filled/duotone** - P4 - L/L - Mic, settings, play icons share one selectable style family.
- **Wallpaper-extracted palette via desktop accent (Tauri)** - P4 - L/H - Native pulls OS accent color to seed app theme.
- **Themeable needle/pointer SVG asset packs** - P3 - M/M - CentsGauge pointer loads from skin set: blade, dial, dot.
- **Gauge face skins: arc, linear bar, half-circle dial** - P3 - M/H - Pluggable CentsGauge rendering bound to one theme choice.
- **Theme import/export as single shareable JSON file** - P3 - M/M - Tokens serialized to .gtheme for swap without a server.
- **Curated built-in theme gallery picker in settings** - P3 - M/L - Thumbnail grid of bundled themes with live preview swatch.
- **Live theme preview before applying in picker** - P4 - L/L - Hover a theme tile to temporarily recolor the tuner.
- **Vintage analog-meter skin with cream face and amber lamp** - P4 - M/M - Skeuomorphic needle, ticks, glow for the gauge component.
- **Per-string accent ramp themeable as a gradient set** - P4 - L/L - Six string hues derive from one editable base ramp.
- **In-tune color semantics override (green-blind safe sets)** - P3 - M/L - Theme defines in-tune/flat/sharp hues, not hardcoded green/amber.
- **Texture/material backdrop layer brushed-metal or felt** - P4 - L/M - Optional subtle tiled SVG behind cards per theme.

## Notifications & re-engagement (20)

- **Tauri tray scheduled daily practice reminder** - P2 - H/M - Native OS notification at user-set hour via tauri-plugin-notification.
- **Streak-at-risk nudge before midnight local time** - P2 - H/M - Fire only if today's session count is zero near cutoff.
- **Quiet-hours window suppressing all reminders** - P2 - H/L - User-defined start/end; clamp scheduled times outside band.
- **Smart reminder time from past session timestamps** - P3 - M/H - Pick modal practice hour from local session-log histogram.
- **Weekly recap notification: strings tuned, accuracy delta** - P3 - M/M - Sunday summary pulled from local IndexedDB session stats.
- **Re-engagement nudge after N days lapsed** - P3 - H/M - Single gentle ping after 7-day inactivity, then escalating cooldown.
- **Per-channel opt-in: OS push vs in-app inbox** - P3 - M/M - Independent toggles per notification type and delivery surface.
- **In-app notification inbox with unread badge** - P3 - M/M - Persistent local list of past nudges, recaps, announcements.
- **New-feature announcement modal keyed to version.json** - P3 - M/L - Show once per build SHA; dismiss persists in localStorage.
- **Do-not-disturb master toggle pausing all nudges** - P3 - M/L - One switch silences reminders for a chosen duration.
- **egui native reminder via notify-rust desktop toast** - P3 - M/M - Standalone egui app schedules its own OS notification.
- **Reminder snooze: remind me in 1 hour** - P3 - M/L - Action button reschedules the nudge without losing streak context.
- **Ear-training challenge-of-the-day push** - P3 - M/M - Daily random-string drill teaser links straight into trainer.
- **Streak-milestone celebration notification at 7/30/100** - P3 - M/L - Positive reinforcement ping on round-number streak days.
- **Frequency cap: max one notification per day** - P3 - M/L - Priority queue collapses competing nudges into single daily send.
- **Tauri autostart with minimized tray for reminders** - P3 - M/M - Launch-on-login so scheduled toasts fire without app open.
- **Weekday-only vs everyday reminder schedule preset** - P4 - L/L - Quick toggle skipping weekends or specific days.
- **Lapse win-back showing personal best streak** - P3 - M/L - Re-engagement copy references user's own record to motivate.
- **String-change due reminder from tuning-drift trend** - P3 - M/M - Notify when drift history suggests old strings; reuse drift data.
- **Notification permission soft-ask after first session** - P3 - M/L - Explain value before triggering OS permission prompt.

## Business & ops depth (no tracking) (20)

- **Donation thermometer SVG fed by static goals.json** - P3 - M/L - Server-maintained JSON renders raised-vs-goal bar, no tracking.
- **In-app roadmap voting via GitHub Discussions reactions embed** - P3 - M/L - Read-only fetch of reaction counts, vote opens GitHub.
- **Refundable 14-day Pro trial with offline grace timer** - P2 - H/M - Local signed expiry, no server, clear refund copy.
- **License-key admin CLI for batch issue and revoke** - P2 - H/M - Offline Ed25519 keygen tool for support staff.
- **Referral unlock: share install link, both get Pro month** - P3 - H/M - Self-signed referral tokens redeemed locally, no backend.
- **Privacy-preserving local aggregate metrics with k-anonymity batching** - P4 - M/H - Opt-in counters flushed only above threshold, no IDs.
- **No-cookie A/B via deterministic install-hash bucketing** - P3 - M/M - Random local seed picks variant, no user tracking.
- **Static public status page for license-verify CDN endpoints** - P4 - L/L - Cron-checked uptime JSON rendered on GitHub Pages.
- **Help-desk widget linking to canned offline troubleshooting answers** - P3 - M/L - Bundled FAQ, deep-links to email with diagnostics prefilled.
- **Canary channel toggle pulling versioned WASM from /tuner/canary/** - P3 - M/M - Opt-in users get prerelease builds before stable promotion.
- **Feature-flag JSON staged-rollout by install-hash percentile** - P3 - M/M - Gradual enable without per-user tracking or server.
- **Affiliate dashboard from signed redemption logs export** - P4 - M/M - Partners self-host CSV of their referral redemptions.
- **Education bulk-license portal generating verified-teacher key batches** - P3 - M/M - Self-serve classroom seat issuance with domain verify.
- **Refund policy page with one-click email-template generator** - P4 - L/L - Prefills order ref and reason for fast support.
- **Donation goal milestones unlock community tuning-pack releases** - P4 - M/L - Funding tiers trigger publishing curated free packs.
- **Gumroad/Lemon Squeezy license-key import verifier offline** - P2 - H/M - Validates third-party-store keys via embedded public key.
- **Annual transparency report: revenue, refunds, zero-data pledge** - P4 - L/L - Published markdown builds trust for privacy positioning.
- **Cohort retention from anonymous local first-run-week buckets** - P4 - M/H - Opt-in coarse week-bucket pings, differential-privacy noise added.
- **Partner co-marketing UTM-free trackable via dedicated redeem codes** - P3 - M/L - Per-partner code namespace measures attribution without URLs.
- **Self-hosted Plausible-style aggregate dashboard, IP-truncated, opt-in** - P4 - M/H - First-party analytics with no cookies or persistent IDs.

