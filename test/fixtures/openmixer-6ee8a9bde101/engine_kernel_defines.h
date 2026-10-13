/* The engine's defines of the sample-rate converter (mix_src.h) and the generators (mix_dsp.h) at
 * openmixer 6ee8a9bde101, the kernels omx-dsp takes over (openmixer#1580). Test input only. */
#define OMX_SRC_TAPS 64
#define OMX_SRC_STOPBAND_DB 96.0
#define OMX_SRC_ROLLOFF 0.92
#define OMX_SRC_MAX_L 1024u
#define OMX_GEN_OSC 0
#define OMX_GEN_WHITE 1
#define OMX_GEN_PINK 2
#define OMX_WAVE_SINE 0
#define OMX_WAVE_SQUARE 1
#define OMX_WAVE_SAW 2
#define OMX_WAVE_TRIANGLE 3
