# Research: 100 Pitch, MIR, Realtime Audio and Dataset Repositories

**Срез:** 2026-07-14
**Цель:** найти проверяемые способы сделать детектор тюнера устойчивее, быстрее и спокойнее визуально, не дублируя существующий [Top-500](TOP-500-backlog.md).

## Как читать этот документ

- Это evidence annex, а не новый канонический backlog. Идентификаторы `X#` ниже являются кандидатами исследования и не занимают номера `M#` или `R#`.
- GitHub stars сняты через GitHub API 2026-07-14 и со временем изменятся. Порядок редакционный: сначала близость к задаче тюнера, затем инженерная ценность, а не сортировка только по stars.
- Из 100 проектов 32 имеют не менее 1000 stars, 16 имеют 500-999, 40 имеют 100-499. Ещё 12 узких проектов ниже 100 stars оставлены сознательно: они содержат редкие реализации PLL, pYIN, harmonic NLS, AudioWorklet/WASM или специализированные тесты.
- README были доступны и просмотрены у всех 100 проектов. Лицензия в таблице взята из GitHub API; `-` означает, что полагаться на автоматическое определение лицензии нельзя.
- Код из copyleft/неясно лицензированных проектов нельзя переносить напрямую. Здесь используются архитектурные и экспериментальные идеи; перед заимствованием кода нужен отдельный license review.

## Главный вывод

Проблема проекта уже не сводится к выбору между YIN и MPM. Сильные решения строят систему из пяти независимых частей:

1. Несколько кандидатов частоты и отдельная мера периодичности/voicing, а не один `frequency + confidence`.
2. Разные правила для атаки щипка, устойчивой части и затухания.
3. Временной трекер, который умеет воздержаться от ответа и не перескакивает на обертон.
4. Реальный корпус записей с известной струной, шумом, реверберацией и точным временем.
5. Метрики пользовательского провала: ложная фиксация, время до верного E2, повторный захват и визуальные скачки, а не только средняя ошибка в центах.

Практический вывод для текущего Tuner: сначала нужен воспроизводимый real-WAV benchmark и исправление уже известных confidence/octave ошибок, затем phase-aware tracking и только после этого более тяжёлые модели. Нейросетевой F0 полезнее сначала как офлайн-оракул CI, а не как новый runtime dependency.

## 100 репозиториев

### A. Pitch detection и готовые тюнеры (1-35)

| # | Репозиторий | Stars | License | Что полезно для Tuner |
|---:|---|---:|---|---|
| 1 | [aubio/aubio](https://github.com/aubio/aubio) | 3722 | GPL-3.0 | Несколько F0-методов, onset detection, фильтрация и разделение transient/steady обработки. |
| 2 | [marl/crepe](https://github.com/marl/crepe) | 1403 | MIT | Waveform-CNN, шаг 10 ms и явный voicing confidence как независимый выход. |
| 3 | [maxrmorrison/torchcrepe](https://github.com/maxrmorrison/torchcrepe) | 522 | MIT | Pitch и periodicity разделены; есть thresholding, декодирование и Viterbi. |
| 4 | [interactiveaudiolab/penn](https://github.com/interactiveaudiolab/penn) | 277 | MIT | Entropy-derived periodicity, cross-domain speech/music и быстрый batch inference. |
| 5 | [lars76/swift-f0](https://github.com/lars76/swift-f0) | 171 | MIT | Маленькая модель, CPU real-time и оценка устойчивости к шуму вне train-domain. |
| 6 | [lars76/pitch-benchmark](https://github.com/lars76/pitch-benchmark) | 77 | MIT | Единый benchmark детекторов на нескольких speech/music/synthetic датасетах. |
| 7 | [Dream-High/RMVPE](https://github.com/Dream-High/RMVPE) | 327 | Apache-2.0 | F0 при шуме и музыкальном сопровождении; хороший внешний oracle для сложных клипов. |
| 8 | [CNChTu/FCPE](https://github.com/CNChTu/FCPE) | 201 | MIT | Компактный context model на depthwise convolutions и noise-robust evaluation. |
| 9 | [sevagh/pitch-detection](https://github.com/sevagh/pitch-detection) | 650 | MIT | FFT-ускоренные YIN/MPM/pYIN, реальные записи и degradation tests. |
| 10 | [peterkhayes/pitchfinder](https://github.com/peterkhayes/pitchfinder) | 504 | - | Сравнимые JS-реализации YIN, MPM, AMDF и dynamic wavelet с разными trade-off. |
| 11 | [cwilso/PitchDetect](https://github.com/cwilso/PitchDetect) | 1385 | MIT | Наглядный browser baseline и документированный octave failure на сильных гармониках. |
| 12 | [ianprime0509/pitchy](https://github.com/ianprime0509/pitchy) | 132 | 0BSD | MPM/NSDF, первый достаточно сильный пик, clarity и volume thresholds. |
| 13 | [cycfi/q](https://github.com/cycfi/q) | 1405 | BSL-1.0 | Низколатентные C++ DSP primitives и production-oriented MPM/pitch components. |
| 14 | [vadymmarkov/Beethoven](https://github.com/vadymmarkov/Beethoven) | 877 | - | Мобильный pipeline захвата и pitch tracking с ограниченными ресурсами. |
| 15 | [alesgenova/pitch-detection](https://github.com/alesgenova/pitch-detection) | 261 | MIT | Маленькое переносимое C++ ядро и понятная граница между DSP и оболочкой. |
| 16 | [audiocogs/pitch.js](https://github.com/audiocogs/pitch.js) | 222 | - | Несколько browser pitch API и простые сравнительные точки интеграции. |
| 17 | [adamski/pitch_detector](https://github.com/adamski/pitch_detector) | 149 | - | Компактная C++ реализация, удобная как независимый differential baseline. |
| 18 | [orchidas/Pitch-Tracking](https://github.com/orchidas/Pitch-Tracking) | 176 | - | Небольшой reference pipeline для проверки peak selection и temporal tracking. |
| 19 | [kylebgorman/swipe](https://github.com/kylebgorman/swipe) | 101 | MIT | SWIPE и scoring по prime harmonics для снижения subharmonic/octave ошибок. |
| 20 | [jkjaer/fastF0Nls](https://github.com/jkjaer/fastF0Nls) | 103 | BSD-3-Clause | Harmonic-model NLS, статистически сильный oracle при colored noise. |
| 21 | [LimingShi/Bayesian-Pitch-Tracking-Using-Harmonic-model](https://github.com/LimingShi/Bayesian-Pitch-Tracking-Using-Harmonic-model) | 99 | GPL-2.0 | Bayesian temporal tracking поверх harmonic likelihood, а не одного локального пика. |
| 22 | [x42/tuna.lv2](https://github.com/x42/tuna.lv2) | 36 | GPL-2.0 | FFT/overtone initial lock, затем узкополосное непрерывное PLL-сопровождение. |
| 23 | [ibancg/lingot](https://github.com/ibancg/lingot) | 108 | GPL-2.0 | Зрелый real-time FFT tuner, microtonal scales и стабильное удержание ноты. |
| 24 | [gillesdegottex/fmit](https://github.com/gillesdegottex/fmit) | 133 | GPL-2.0 | История pitch, temperaments, шумовые настройки и зрелая desktop tuner UX. |
| 25 | [hybridpicker/pro-tuner](https://github.com/hybridpicker/pro-tuner) | 2 | - | 8192 samples для баса, overlap, median-5, EMA, noise calibration и attack/sustain. |
| 26 | [JorenSix/TarsosDSP](https://github.com/JorenSix/TarsosDSP) | 2179 | GPL-3.0 | YIN, MPM, dynamic wavelet, Goertzel и onset processors в одной библиотеке. |
| 27 | [FastTune/FastTune](https://github.com/FastTune/FastTune) | 52 | MIT | Timbre-aware transformer и перенос inference в WebAssembly. |
| 28 | [alesgenova/pitch-detection-app](https://github.com/alesgenova/pitch-detection-app) | 126 | MIT | Проверяемая интеграция одного DSP core в desktop/web UI. |
| 29 | [Sytronik/pyin-rs](https://github.com/Sytronik/pyin-rs) | 11 | MIT | Rust pYIN: multiple candidates, probabilistic thresholds и temporal decoding. |
| 30 | [sevagh/pitchlite](https://github.com/sevagh/pitchlite) | 10 | MIT | MPM в WASM/AudioWorklet и обработка нескольких каналов одновременно. |
| 31 | [adrielcafe/chroma](https://github.com/adrielcafe/chroma) | 130 | MIT | Multiplatform mobile audio/pitch integration и компактная UI boundary. |
| 32 | [rohankhayech/Choona](https://github.com/rohankhayech/Choona) | 70 | GPL-3.0 | Практический cross-platform tuner workflow и platform adapter lessons. |
| 33 | [DonBraulio/tuneo](https://github.com/DonBraulio/tuneo) | 120 | - | Offline-first web tuner и простая installable PWA delivery. |
| 34 | [TuneNN/TuneNN](https://github.com/TuneNN/TuneNN) | 166 | - | Модель учитывает эволюцию тембра и гармоник во времени, а не отдельный frame. |
| 35 | [sonic-visualiser/tony](https://github.com/sonic-visualiser/tony) | 63 | GPL-2.0 | Интерактивная проверка и ручная коррекция F0 contour для golden annotations. |

### B. MIR, transcription и audio analysis (36-60)

| # | Репозиторий | Stars | License | Что полезно для Tuner |
|---:|---|---:|---|---|
| 36 | [librosa/librosa](https://github.com/librosa/librosa) | 8498 | ISC | YIN/pYIN, CQT, feature extraction и удобный offline evaluation harness. |
| 37 | [MTG/essentia](https://github.com/MTG/essentia) | 3623 | AGPL-3.0 | Production C++ MIR algorithms, streaming graph и extensive descriptors. |
| 38 | [MTG/essentia.js](https://github.com/MTG/essentia.js) | 854 | AGPL-3.0 | Перенос C++ DSP в WebAssembly для offline и real-time browser анализа. |
| 39 | [libAudioFlux/audioFlux](https://github.com/libAudioFlux/audioFlux) | 3334 | MIT | FFT/CQT/cepstrum/HPS/onset и высокопроизводительный C backend. |
| 40 | [CPJKU/madmom](https://github.com/CPJKU/madmom) | 1673 | - | Onset/beat processors и temporal models как образец phase segmentation. |
| 41 | [mir-evaluation/mir_eval](https://github.com/mir-evaluation/mir_eval) | 706 | MIT | Стандартные voicing recall/false alarm, raw pitch/chroma и overall metrics. |
| 42 | [mir-dataset-loaders/mirdata](https://github.com/mir-dataset-loaders/mirdata) | 412 | BSD-3-Clause | Версионирование, checksums, лицензии, индексы и reproducible dataset loaders. |
| 43 | [musicinformationretrieval/musicinformationretrieval.com](https://github.com/musicinformationretrieval/musicinformationretrieval.com) | 1277 | MIT | Воспроизводимые notebooks для спектра, CQT, onset и evaluation. |
| 44 | [magenta/ddsp](https://github.com/magenta/ddsp) | 3318 | Apache-2.0 | Harmonic signal models и differentiable diagnostics для synthetic fixtures. |
| 45 | [spotify/basic-pitch](https://github.com/spotify/basic-pitch) | 5284 | Apache-2.0 | Lightweight polyphonic pitch/note inference и pitch-bend trajectories. |
| 46 | [spotify/basic-pitch-ts](https://github.com/spotify/basic-pitch-ts) | 344 | Apache-2.0 | Browser inference, chunking и TypeScript/WASM/model boundary. |
| 47 | [magenta/mt3](https://github.com/magenta/mt3) | 1728 | Apache-2.0 | Multi-task transcription и sequence-level decoding как offline comparator. |
| 48 | [Music-and-Culture-Technology-Lab/omnizart](https://github.com/Music-and-Culture-Technology-Lab/omnizart) | 1940 | MIT | Модульные pipelines и явное разделение моделей по музыкальным задачам. |
| 49 | [openvpi/SOME](https://github.com/openvpi/SOME) | 699 | MIT | Singing F0-to-note segmentation и устойчивые temporal boundaries. |
| 50 | [Yujia-Yan/Transkun](https://github.com/Yujia-Yan/Transkun) | 377 | MIT | Sequence decoding и penalties переходов между pitch/note states. |
| 51 | [justinsalamon/audio_to_midi_melodia](https://github.com/justinsalamon/audio_to_midi_melodia) | 637 | - | Salience peaks плюс temporal melody tracking в сложной смеси. |
| 52 | [cwitkowitz/amt-tools](https://github.com/cwitkowitz/amt-tools) | 38 | MIT | Общий interface для моделей, датасетов и метрик, полезный для detector lab. |
| 53 | [alexanderlerch/pyACA](https://github.com/alexanderlerch/pyACA) | 176 | MIT | Проверяемые Python reference implementations audio-content features. |
| 54 | [alexanderlerch/ACA-Code](https://github.com/alexanderlerch/ACA-Code) | 87 | MIT | Matlab baselines для независимой численной сверки DSP. |
| 55 | [adamstark/Gist](https://github.com/adamstark/Gist) | 400 | GPL-3.0 | Компактные real-time C++ audio features и простой stable API. |
| 56 | [ar1st0crat/NWaves](https://github.com/ar1st0crat/NWaves) | 546 | MIT | Большой набор reference filters, FFT, resampling и DSP tests. |
| 57 | [SuperKogito/spafe](https://github.com/SuperKogito/spafe) | 485 | BSD-3-Clause | Cepstral/spectral features для диагностики шума и тембра. |
| 58 | [mmorise/World](https://github.com/mmorise/World) | 1326 | - | Раздельные F0, spectral envelope и aperiodicity estimates. |
| 59 | [JeremyCCHsu/Python-Wrapper-for-World-Vocoder](https://github.com/JeremyCCHsu/Python-Wrapper-for-World-Vocoder) | 789 | MIT | Удобный batch oracle для F0/aperiodicity в исследовательских скриптах. |
| 60 | [LCAV/pyroomacoustics](https://github.com/LCAV/pyroomacoustics) | 1903 | MIT | Контролируемые room impulse responses, RT60 и microphone geometry tests. |

### C. Realtime audio, Rust и Web Audio (61-80)

| # | Репозиторий | Stars | License | Что полезно для Tuner |
|---:|---|---:|---|---|
| 61 | [RustAudio/cpal](https://github.com/RustAudio/cpal) | 3846 | Apache-2.0 | Реальные stream/device semantics, runtime errors и callback constraints. |
| 62 | [RustAudio/dasp](https://github.com/RustAudio/dasp) | 1167 | - | Типы sample/frame/signal и composable DSP без UI coupling. |
| 63 | [ejmahler/RustFFT](https://github.com/ejmahler/RustFFT) | 919 | Apache-2.0 | Planner reuse, scratch buffers, SIMD и стабильные performance tests. |
| 64 | [RustAudio/rodio](https://github.com/RustAudio/rodio) | 2415 | Apache-2.0 | Output-device lifecycle и reference-tone playback patterns. |
| 65 | [chaosprint/glicol](https://github.com/chaosprint/glicol) | 2982 | MIT | Rust/WASM audio graph и единое DSP ядро для native/browser. |
| 66 | [mdn/webaudio-examples](https://github.com/mdn/webaudio-examples) | 1426 | CC0-1.0 | Канонические AudioWorklet lifecycle и browser examples. |
| 67 | [chrisguttandin/standardized-audio-context](https://github.com/chrisguttandin/standardized-audio-context) | 776 | MIT | Cross-browser differences Web Audio и тестируемая compatibility layer. |
| 68 | [WebAudio/web-audio-api](https://github.com/WebAudio/web-audio-api) | 1124 | - | Нормативные render quantum, timing и AudioWorklet contracts. |
| 69 | [GoogleChromeLabs/web-audio-samples](https://github.com/GoogleChromeLabs/web-audio-samples) | 748 | Apache-2.0 | SharedArrayBuffer ring, Worker/Worklet split и WASM patterns. |
| 70 | [padenot/ringbuf.js](https://github.com/padenot/ringbuf.js) | 238 | MPL-2.0 | Wait-free SPSC queue поверх SharedArrayBuffer/Atomics. |
| 71 | [superpoweredSDK/web-audio-javascript-webassembly-SDK-interactive-audio](https://github.com/superpoweredSDK/web-audio-javascript-webassembly-SDK-interactive-audio) | 177 | - | Low-latency browser DSP и WASM memory-sharing patterns. |
| 72 | [Picovoice/web-voice-processor](https://github.com/Picovoice/web-voice-processor) | 245 | Apache-2.0 | Worklet framing, Worker delivery и robust start/stop semantics. |
| 73 | [realtime-ai/realtime-audio-sdk](https://github.com/realtime-ai/realtime-audio-sdk) | 125 | MIT | Capture pipeline, VAD-style gating и observable realtime state. |
| 74 | [Ableton/AudioPerfLab](https://github.com/Ableton/AudioPerfLab) | 143 | MIT | Deadline-oriented real-time audio performance experiments. |
| 75 | [samaaron/supersonic](https://github.com/samaaron/supersonic) | 211 | - | Один engine в AudioWorklet и native shells, хороший portability case. |
| 76 | [webaudiomodules/api](https://github.com/webaudiomodules/api) | 204 | - | Разделение DSP, UI, parameters и serializable state contract. |
| 77 | [Tonejs/Tone.js](https://github.com/Tonejs/Tone.js) | 14674 | MIT | AudioContext clock, scheduling и независимость аудио-времени от UI paint. |
| 78 | [hvianna/audioMotion-analyzer](https://github.com/hvianna/audioMotion-analyzer) | 926 | AGPL-3.0 | Оптимизированная real-time spectrum visualization и adaptive rendering. |
| 79 | [meyda/meyda](https://github.com/meyda/meyda) | 1650 | MIT | Feature extraction в browser/AudioWorklet с компактным API. |
| 80 | [GoogleChrome/audion](https://github.com/GoogleChrome/audion) | 392 | Apache-2.0 | Инспекция Web Audio graph и диагностика потерянных/лишних nodes. |

### D. DSP, noise и production audio (81-90)

| # | Репозиторий | Stars | License | Что полезно для Tuner |
|---:|---|---:|---|---|
| 81 | [juce-framework/JUCE](https://github.com/juce-framework/JUCE) | 8644 | - | Проверенная processor/editor boundary, callback discipline и cross-platform audio. |
| 82 | [xiph/rnnoise](https://github.com/xiph/rnnoise) | 5709 | BSD-3-Clause | Hybrid DSP/neural design и реальные noisy datasets; не готовый tuner prefilter. |
| 83 | [Rikorose/DeepFilterNet](https://github.com/Rikorose/DeepFilterNet) | 4451 | - | Noise/reverb augmentation, latency accounting и low-complexity modeling. |
| 84 | [timsainb/noisereduce](https://github.com/timsainb/noisereduce) | 1854 | MIT | Spectral-gating baseline для измерения возможного pitch bias preprocessing. |
| 85 | [HEnquist/camilladsp](https://github.com/HEnquist/camilladsp) | 1002 | GPL-3.0 | Typed filter pipeline, runtime configuration и measurable DSP stages. |
| 86 | [Signalsmith-Audio/signalsmith-stretch](https://github.com/Signalsmith-Audio/signalsmith-stretch) | 516 | MIT | Phase/frequency handling и качественные numerical/perceptual tests. |
| 87 | [bungee-audio-stretch/bungee](https://github.com/bungee-audio-stretch/bungee) | 327 | MPL-2.0 | Явный trade-off quality, latency и compute в real-time DSP. |
| 88 | [micknoise/Maximilian](https://github.com/micknoise/Maximilian) | 1696 | MIT | Минимальные переносимые DSP building blocks для прототипов. |
| 89 | [madrona-labs/madronalib](https://github.com/madrona-labs/madronalib) | 335 | MIT | Realtime-oriented data flow и lock-free DSP architecture. |
| 90 | [Signalsmith-Audio/dsp](https://github.com/Signalsmith-Audio/dsp) | 271 | MIT | Фильтры, FFT helpers и небольшие численно аккуратные components. |

### E. Датасеты и evaluation infrastructure (91-100)

| # | Репозиторий | Stars | License | Что полезно для Tuner |
|---:|---|---:|---|---|
| 91 | [marl/medleydb](https://github.com/marl/medleydb) | 213 | MIT | Stems, instrument metadata и source-level F0 evaluation. |
| 92 | [marl/GuitarSet](https://github.com/marl/GuitarSet) | 164 | MIT | Hexaphonic per-string guitar channels, string/fret/style и F0 contours. |
| 93 | [jthickstun/pytorch_musicnet](https://github.com/jthickstun/pytorch_musicnet) | 75 | - | Audio с aligned musical labels и воспроизводимые dataset splits. |
| 94 | [mdeff/fma](https://github.com/mdeff/fma) | 2639 | MIT | Dataset manifests, checksums, metadata и маленькие reproducible subsets. |
| 95 | [MTG/mtg-jamendo-dataset](https://github.com/MTG/mtg-jamendo-dataset) | 396 | Apache-2.0 | Версионированные splits, baselines и large-scale metadata discipline. |
| 96 | [gabolsgabs/DALI](https://github.com/gabolsgabs/DALI) | 380 | - | Annotation confidence, alignment provenance и error-aware labels. |
| 97 | [microsoft/DNS-Challenge](https://github.com/microsoft/DNS-Challenge) | 1440 | CC-BY-4.0 | Стандартизованные noise/reverb recipes и objective test partitions. |
| 98 | [microsoft/MS-SNSD](https://github.com/microsoft/MS-SNSD) | 594 | MIT | Масштабируемая генерация смесей по noise type и заданному SNR. |
| 99 | [soundata/soundata](https://github.com/soundata/soundata) | 357 | BSD-3-Clause | Общий download/cache/validate/index interface для audio datasets. |
| 100 | [sigsep/sigsep-mus-db](https://github.com/sigsep/sigsep-mus-db) | 201 | MIT | Stem-based evaluation и controlled interference mixtures. |

## Научные материалы и инженерные первоисточники

| Источник | Проверяемый вывод | Что из этого следует для Tuner |
|---|---|---|
| [YIN, de Cheveigne and Kawahara, JASA 2002](https://doi.org/10.1121/1.1458024) | CMNDF и absolute threshold уменьшают типовые ошибки autocorrelation при небольшой задержке. | Сохранять YIN как baseline, но не считать его единственным арбитром. |
| [McLeod Pitch Method, ICMC 2005](https://quod.lib.umich.edu/i/icmc/bbp2372.2005.107/1/--smarter-way-to-find-pitch?page=root%3Bsize%3D75%3Bview%3Dtext) | NSDF даёт отдельную clarity и выбирает первый достаточно сильный максимум. | Clarity должна быть самостоятельным диагностическим сигналом. |
| [SWIPE, Camacho and Harris, JASA 2008](https://pubmed.ncbi.nlm.nih.gov/19045655/) | Сходство с sawtooth и prime harmonics снижает subharmonic ambiguity. | Добавить независимый harmonic score для octave guard. |
| [YAAPT, Zahorian and Hu, JASA 2008](https://ws.binghamton.edu/zahorian/pdf/zahorian2008spectral.pdf) | Time-domain и spectral candidates объединяются, затем лучший track ищется dynamic programming. | Не схлопывать каждый frame до одного кандидата до temporal stage. |
| [PEFAC, Gonzalez and Brookes, IEEE 2014](https://ieeexplore.ieee.org/document/6701334/) | Log-frequency filtering и amplitude compression повышают устойчивость к сильному шуму. | Иметь spectral cross-check и colored-noise benchmark, не только white noise. |
| [pYIN, Mauch and Dixon, ICASSP 2014](https://doi.org/10.1109/ICASSP.2014.6853678) | Вероятностные thresholds дают несколько кандидатов, HMM/Viterbi выбирает последовательность. | Реализовывать `M115` после появления top-K candidate contract. |
| [Fast fundamental frequency estimation, Nielsen et al., Signal Processing 2017](https://vbn.aau.dk/da/publications/fast-fundamental-frequency-estimation-making-a-statistically-effi/) | Harmonic-model maximum likelihood можно приблизить с практической сложностью. | Использовать fast NLS как offline oracle для сложного шума, не обязательно в runtime. |
| [CREPE, Kim et al., ICASSP 2018](https://arxiv.org/abs/1802.06182) | Raw-waveform CNN выдаёт pitch distribution и voicing confidence, проверяется на noise robustness. | Сравнивать не только Hz, но posterior/confidence и out-of-domain деградацию. |
| [Generalized metrics for single-F0, Bittner and Bosch, ISMIR 2019](https://archives.ismir.net/ismir2019/paper/000090.pdf) | Binary voicing threshold искажает сравнение; continuous voicing и energy weighting дают threshold-independent оценку. | Калибровать voicing probability и строить reliability metrics. |
| [Bayesian Pitch Tracking Based on the Harmonic Model, 2019](https://arxiv.org/abs/1905.08557) | Harmonic likelihood и temporal Bayesian update устойчивее чистой autocorrelation при шуме. | Выделить harmonic fit и temporal prior отдельными слоями. |
| [SPICE, Google Research, 2020](https://research.google/pubs/spice-self-supervised-pitch-estimation/) | Transposition-equivariant self-supervision обучает pitch без ручных F0 labels и даёт confidence. | Добавить metamorphic transposition tests даже для deterministic DSP. |
| [A Robust and Low Computational Cost Pitch Estimation Method, Sensors 2022](https://pmc.ncbi.nlm.nih.gov/articles/PMC9414051/) | Сравнение YIN, PEFAC, RAPT, YAAPT, SWIPE, CREPE и fast NLS показывает разные лидеры при noise, colored noise и reverb; compute cost тоже различается. | Release gate должен быть многомерным: accuracy, false locks, latency и CPU. |
| [PENN, Morrison et al., 2023](https://arxiv.org/abs/2301.12258) | Pitch и periodicity разделены; entropy помогает оценить periodicity на speech и music. | Не смешивать periodicity с RMS и detector acceptance threshold. |
| [RMVPE, Wei et al., 2023](https://arxiv.org/abs/2306.15412) | Модель специально оптимизирована для noise и accompaniment interference. | Использовать её как второй offline oracle на загрязнённых клипах. |
| [GuitarSet, Xi et al., ISMIR 2018](https://ir.webis.de/anthology/2018.ismir_conference-2018.60/) | Hexaphonic channels дают отдельную истину для каждой струны вместе с F0 contours и playing style. | Собрать легальный per-string golden subset для E2-A2-D3-G3-B3-E4. |
| [GuitarSet dataset record](https://zenodo.org/records/3371780) | Версионированный архив и metadata позволяют фиксировать точный subset/hash. | Fixture manifest должен хранить dataset version, file hash и segment offsets. |
| [GAPS: A Large and Diverse Classical Guitar Dataset, 2024](https://arxiv.org/abs/2408.08653) | Более широкий гитарный материал помогает обнаружить domain shift относительно маленьких студийных наборов. | Проверять не только isolated notes, но реальные фразы и разные инструменты. |
| [PESTO, Riou et al., TISMIR 2025](https://transactions.ismir.net/en/articles/10.5334/tismir.251) | Causal lightweight model, self-supervised equivariance и explicit real-time evaluation. | Нейросетевой кандидат имеет смысл лишь после CPU/latency Pareto gate. |
| [SwiftF0, 2025](https://arxiv.org/abs/2508.18440) | Маленькая модель и единый cross-domain/noise benchmark показывают, что average accuracy недостаточна. | Взять benchmark design и offline oracle раньше, чем runtime model. |
| [FCPE, 2025](https://arxiv.org/abs/2509.15140) | Depthwise context modeling даёт компактность и устойчивость к noise. | Если дойдём до ML, сравнивать causal compact models, а не только CREPE. |
| [Web Audio API specification](https://github.com/WebAudio/web-audio-api) | Render quantum является частью audio timeline; consumer не должен связывать DSP с paint loop. | Перенести capture cadence из `requestAnimationFrame` в AudioWorklet. |
| [MDN AudioWorkletProcessor.process](https://developer.mozilla.org/en-US/docs/Web/API/AudioWorkletProcessor/process) | Сейчас обычно приходит 128 frames, но код обязан читать фактическую длину блока, потому что размер может стать переменным. | Запретить hardcoded `128` и тестировать несколько quantum sizes. |
| [Chrome Audio Worklet design pattern](https://developer.chrome.com/blog/audio-worklet-design-pattern) | SharedArrayBuffer ring согласует маленькие render quanta с более крупными WASM/DSP blocks. | Worklet пишет samples/timebase, Worker собирает окна и запускает core. |

## Новые кандидаты после дедупликации

Эти пункты не найдены как самостоятельные элементы в текущем `M1-M500`. Некоторые расширяют существующие `M#`; связь указана явно. Их стоит промотировать в канонический backlog только после короткого design/measurement pass.

| X# | Pri | Кандидат | Definition of done | Связь с текущим backlog |
|---|---|---|---|---|
| X1 | P0 | Tuner-specific temporal metrics | CI считает time-to-first-correct, false-lock duration, reacquisition latency, note changes/sec и stable-sustain cents MAE. | Расширяет `M61`, `M94`; не дублирует пользовательский `M310`. |
| X2 | P0 | Scenario matrix вместо среднего score | Отчёт разбит по string, phase, SNR, noise, RT60, mic/device, sample rate и backend. | Расширяет `M94`. |
| X3 | P0 | Continuous voicing/periodicity calibration | Reliability diagram, Brier score и ECE для voiced/usable решения на real-WAV corpus. | Текущий confidence contract калибрует шкалу между backends, но не вероятность правильности. |
| X4 | P0 | Разделить quality vector | Frame/diagnostics несёт `periodicity`, `voicing`, `harmonicFit`, `methodAgreement`, `level`; UI получает только derived state. | Заменяет перегруженный одним смыслом scalar confidence. |
| X5 | P0 | Явные unresolved reasons | `silence`, `tooQuiet`, `attack`, `ambiguousHarmonic`, `unstable`, `backendFailure`; каждый имеет тест и спокойный UX. | Развивает уже существующий `resolved/unresolved`, не создаёт второй lifecycle. |
| X6 | P0 | Pluck phase state machine | Onset переводит signal через `attack -> sustain -> release`; stable note не подтверждается на ранней атаке. | Новое; отдельный bowed-string `M367` слишком узок. |
| X7 | P0 | Phase-dependent analysis policy | Быстрый short-hop candidate на attack, длинное low-note окно на sustain, hold/decay policy на release. | Объединяет, но не дублирует `M12` и `M27`. |
| X8 | P0 | Top-K candidate lattice API | Каждый detector отдаёт candidates с Hz, score, source, lag/bin и harmonic relation; fusion/track работают поверх lattice. | Нужная граница для `M30` и `M115`. |
| X9 | P1 | Detector disagreement as uncertainty | При octave-related YIN/MPM/HPS disagreement frame воздерживается или удерживает прошлую ноту; есть отдельная метрика. | `M30` описывает fusion, но не uncertainty/abstention. |
| X10 | P1 | Offline neural oracle в CI | SwiftF0/PENN и RMVPE прогоняются только research job; runtime/bundle остаются deterministic Rust/WASM. | Новое; снижает риск преждевременно тащить ML в приложение. |
| X11 | P1 | Multi-implementation differential lab | Один manifest прогоняется через current core, YIN/MPM baselines, SWIPE/fast NLS и neural oracles; сохраняется disagreement report. | Существенно расширяет `M61`. |
| X12 | P1 | Metamorphic DSP suite | Pitch-shift equivariance, gain/time-shift/phase/polarity invariance, resampling consistency и DC-offset transformations. | Дополняет `M32` и обычные fixtures. |
| X13 | P1 | GuitarSet per-string fixture pack | Лицензированный subset с шестью струнами, несколькими гитарами/стилями, точными segments и hashes. | Конкретизирует общий запрос real-WAV fixtures. |
| X14 | P1 | Attack/sustain/release annotations | Каждый fixture имеет onset, stable interval и audible release; metrics считаются раздельно. | Новое, требуется для `X6-X7`. |
| X15 | P1 | Noise/reverb stress generator | Clean guitar смешивается с pink/brown/fan/mains/impulse noise по SNR и room IR по RT60; seed фиксирован. | Расширяет `M78`, `M94`. |
| X16 | P1 | Preprocessor pitch-bias gate | Любой high-pass/notch/gate/denoiser обязан доказать отсутствие systematic cents/octave bias по corpus. | Новая защита; speech denoisers не включаются по умолчанию. |
| X17 | P1 | Reproducible capture/replay envelope | Raw PCM/WAV хранится вместе с config revision, device/sample-rate, chunk timing и expected intervals. | Развивает file/WAV adapter и `M98`, но сохраняет timing failures. |
| X18 | P1 | End-to-end sample timebase | Frames несут `sampleIndex`, `capturedAt`, `processedAt`, `publishedAt`; latency измеряется, а не оценивается по wall clock UI. | Новое; закрывает архитектурный пробел `FrameBase`. |
| X19 | P1 | Audio queue telemetry | Sequence gaps, overrun/underrun, high-water mark, dropped chunks и deadline misses доступны тестам/diagnostics. | Расширяет `M81` и текущий bounded queue. |
| X20 | P1 | Variable render-quantum tests | AudioWorklet path проходит 64/128/256-frame blocks без изменения pitch/timebase. | Новое требование из Web Audio contract. |
| X21 | P1 | Statistical release gates | Для каждого scenario есть sample count, bootstrap confidence interval и non-regression threshold, а не один случайный clip. | Новое поверх `M94`. |
| X22 | P1 | Accuracy/latency/CPU/memory Pareto gate | PR artifact показывает frontier; улучшение cents не принимается ценой missed audio deadlines. | Новое; особенно важно перед `M30`, `M115` или ML. |
| X23 | P2 | Automatic failing-clip minimizer | Ошибочный WAV сокращается до минимального segment с тем же false lock и сохраняется как regression fixture. | Новое; ускоряет расследование полевых записей. |
| X24 | P1 | Dataset provenance manifest | Для каждого external fixture: source, version, license, attribution, hash, local segment и redistribution rule; CI валидирует. | Формализует общий пункт о licensed WAV. |
| X25 | P2 | Benchmark-selected detector profiles | Наборы thresholds/windows выбираются по instrument/range/phase через corpus и versioned config, не скрыты в magic numbers. | Расширяет `M91`, `M320`. |
| X26 | P2 | Human-audited hard-case set | Ошибочные octave/voicing boundaries проверяются слухом через sonification и сохраняют reviewer/provenance. | Следует практике Tony и новых вручную проверенных F0 datasets. |
| X27 | P2 | Harmonic-fit residual diagnostic | После выбора F0 оценивается ошибка частот/амплитуд partials; высокий residual снижает trust, но не меняет pitch сам. | Независимый сигнал для `X4`, не новый detector. |
| X28 | P1 | Entropy-driven settling UX | UI фиксирует note label, пока candidate entropy высока; показывает нейтральное settling/ambiguous состояние без скачков между нотами. | Новое UX-применение uncertainty; не дублирует обычный EMA/hysteresis. |

## Уже есть в Top-500: не создавать дубли

Исследование усиливает приоритет следующих существующих пунктов:

| Существующий пункт | Почему теперь важнее |
|---|---|
| `M4` octave-error guard | Прямо отвечает на наблюдаемое E2 -> E3/около 160 Hz. |
| `M9` HPS octave disambiguator | SWIPE, harmonic NLS и реальные tuner implementations подтверждают пользу независимого harmonic evidence. |
| `M10` high-pass rumble/mains | Нужен как измеряемый phase-safe prefilter под `X16`, а не как необоснованная косметика. |
| `M12` dual-window | 82 Hz требует длинного контекста, атака и high strings требуют малого latency. |
| `M15` adaptive noise floor | Нужен после исправления обратного quiet-signal threshold из `R210`. |
| `M17`/`M55` selected-string tau bounds | Самый дешёвый способ убрать чужие октавы, когда пользователь выбрал струну. |
| `M19`/`M69` cadence вне rAF и AudioWorklet | Official Web Audio contracts подтверждают, что paint loop не является audio clock. |
| `M30` detector fusion | Реализовывать через `X8` и `X9`, а не weighted average единственных победителей. |
| `M42` real fixture snapshots | Делать на `X13-X15`, а не на одних синусах. |
| `M61` golden differential runner | Расширить до `X1`, `X11` и temporal failure metrics. |
| `M76` WASM SIMD | Только после `X22`; сначала измерить, где реальный hotspot. |
| `M78` plucked harmonic generator | Добавить decay envelopes, inharmonicity, attack noise и fixed seeds. |
| `M79` cepstrum cross-check | Ещё один независимый candidate/evidence source для `X8`. |
| `M85` decimation | Проверить metamorphic resampling consistency из `X12`. |
| `M93` Kalman и `M115` pYIN/Viterbi | Сравнить на false-lock/reacquisition, не выбирать по визуальной плавности. |

## Уже известные текущие дефекты, которые блокируют честный benchmark

До экспериментов нельзя забыть текущий grounded audit:

1. `R210`: quiet/noisy signal получает более permissive YIN threshold, то есть адаптация направлена в неправильную сторону.
2. `R209`: отображаемый YIN confidence фактически обрезан acceptance gate и не является калиброванной вероятностью.
3. `R227`: TS fallback после деградации показывает искусственные `0` или `100%` confidence.
4. `R73`: file/WAV input adapter отсутствует, поэтому реальные regression clips нельзя прогнать через тот же session path.
5. `R26`: включённый spectrum продолжает создавать owned `Vec` на каждый frame.
6. `R324`: критический cadence/recycling path native audio не имеет тестов.

## Рекомендуемый порядок экспериментов

### Experiment 1: измеряем хаос до изменений

- Реализовать file/WAV adapter и `X1`, не меняя detector.
- Взять 24-36 коротких GuitarSet segments: по 4-6 на каждую стандартную струну, с отдельными attack/sustain labels.
- Зафиксировать baseline native/WASM/TS: false-lock duration, first-correct latency, note changes/sec, sustain cents MAE и CPU.

### Experiment 2: исправляем существующие ошибки и octave guard

- Исправить `R210`, перестать показывать fabricated confidence (`R209`, `R227`).
- Реализовать `M4`, `M9`, `M17/M55` за `X8` candidate boundary.
- Принять изменение только если падают false-lock duration и visual churn без ухудшения latency Pareto.

### Experiment 3: phase-aware tracking

- Добавить `X6-X7`, `X14` и explicit ambiguity reasons `X5`.
- На attack разрешать быстрый preliminary candidate, но не менять stable note при высокой entropy/disagreement.
- На sustain использовать длинное low-frequency окно и подтверждение harmonic evidence.

### Experiment 4: независимый audio clock

- Реализовать `M19/M69` вместе с `X18-X20`: AudioWorklet -> SPSC ring -> Worker/WASM.
- UI читать immutable latest frame и анимировать независимо; background-tab/paint stalls не должны менять DSP cadence.

### Experiment 5: offline oracle и release gate

- Добавить research-only SwiftF0/PENN/RMVPE и SWIPE/fast NLS runners.
- Ввести `X11`, `X21`, `X22`; не включать ML runtime, пока deterministic core не проигрывает измеримо на целевом corpus.

## Чего пока не делать

- Не заменять YIN на единственную нейросеть: это увеличит bundle, startup и domain-shift risk, не объяснив нынешний octave lock.
- Не вставлять RNNoise/DeepFilterNet перед detector без `X16`: speech denoiser может деформировать fundamental/partials гитары.
- Не добавлять ещё один EMA только ради спокойной стрелки: он скрывает ошибки и увеличивает reacquisition latency.
- Не оптимизировать SIMD до появления benchmark profile: основная проблема сейчас correctness/temporal policy, а не доказанный CPU bottleneck.
- Не копировать GPL/AGPL/неясно лицензированный код в MIT/проприетарные части проекта без отдельного решения по лицензированию.

## Decision gate

Исследование считается полезным только если следующий DSP PR прикладывает до/после artifact минимум по пяти числам: false-lock duration, first-correct latency, reacquisition latency, sustain cents MAE и CPU/deadline misses. Скриншот спокойной стрелки без raw replay и этих метрик больше не является доказательством улучшения.
