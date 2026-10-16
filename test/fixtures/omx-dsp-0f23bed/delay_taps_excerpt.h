/* omx-dsp 0f23bed source excerpts, verbatim: test/fx/delay_taps.test.c:56-60 (the tap factor set) and include/omxdsp/fx/omx_delay.h:38-41 (the tap-array ceiling). */
/** The tap-delay factor set, num/den, in its declared order (2026-09-26 tap-delay variants §3:
 * DELAY_TAP_FACTORS). omx-contract does not render it yet; the kernel never reads it, only this
 * oracle's choice of taps. */
static const int TAP_NUM[] = { 1, 1, 3, 1, 2, 3, 1, 4, 3, 2, 3 };
static const int TAP_DEN[] = { 4, 3, 8, 2, 3, 4, 1, 3, 2, 1, 1 };
/** Read-tap ceiling of the one ring per leg: the tap-delay variants' `taps` travel 1..4. omx-contract
 * does not declare that travel yet (FX_DELAY_TAPS_RANGE, to be rendered as OMX_DELAY_TAPS_MAX); when
 * it does, this reads it, as OMX_FXDELAY_MAX_MS reads the time travel. */
#define OMX_FXDELAY_MAX_TAPS 4
