/*
 * DETECTOR TOPOLOGY — the comp row's `detectorTopology`, resolved into the RT atom
 * (openmixer docs/design/specs/2026-09-26-ssl-bus-compressor.md §3a). The member index follows the
 * declaration's order, `feedforward` first, so a zeroed atom is the compressor every slot runs.
 */
/** @brief `feedforward`: the detector hears the slot's input (or its key). */
#define OMX_DYN_TOPOLOGY_FEEDFORWARD 0
/** @brief `feedback`: the detector hears the slot's own pre-make-up output, one sample late,
 * through ONE envelope stage (§1). A keyed slot detects its key and stays feed-forward. */
#define OMX_DYN_TOPOLOGY_FEEDBACK 1

/** @brief The feedback loop's own delay, samples: `y[n]` depends on the gain at `n`, so the
 * detector can only have heard `y[n − 1]`. Not a latency: the audio is never delayed by it. */
#define OMX_DYN_FB_LOOP_DELAY_SAMPLES 1u
