/* omx-dsp 0f23bed include/omxdsp/fx/omx_mbcomp.h:49-81, verbatim: the multiband limits the kernel staged until omx-contract declares them. */
/* The multiband limits are omx-contract's (omx-contract#62: the band count travel, the corner line
 * and the come-up corners by band count). Until the contract release carries them they are staged
 * here, each behind its own #ifndef so the contract's definition wins the day it is installed. The
 * floor bump that adopts that release deletes this block: from that floor on,
 * tools/contract-single-source.sh names every line of it that is still here. */
#ifndef OMX_MBC_MIN_BANDS
/** @brief The fewest bands the stage splits into: one crossover. */
#define OMX_MBC_MIN_BANDS 2u
#endif
#ifndef OMX_MBC_MAX_BANDS
/** @brief The most bands the stage splits into, and the capacity of its state. */
#define OMX_MBC_MAX_BANDS 5u
#endif
#ifndef OMX_MBC_CORNER_MAX_FRACTION
/** @brief The highest corner the design builds, as a fraction of the rate; a higher one is built at it. */
#define OMX_MBC_CORNER_MAX_FRACTION 0.45
#endif
#ifndef OMX_MBC_CROSSOVER_DEFAULTS_2_INIT
/** @brief The come-up corners of a 2-band stage, Hz. */
#define OMX_MBC_CROSSOVER_DEFAULTS_2_INIT { 1000.0f }
#endif
#ifndef OMX_MBC_CROSSOVER_DEFAULTS_3_INIT
/** @brief The come-up corners of a 3-band stage, Hz: body, presence, air. */
#define OMX_MBC_CROSSOVER_DEFAULTS_3_INIT { 200.0f, 2000.0f }
#endif
#ifndef OMX_MBC_CROSSOVER_DEFAULTS_4_INIT
/** @brief The come-up corners of a 4-band stage, Hz. */
#define OMX_MBC_CROSSOVER_DEFAULTS_4_INIT { 150.0f, 800.0f, 5000.0f }
#endif
#ifndef OMX_MBC_CROSSOVER_DEFAULTS_5_INIT
/** @brief The come-up corners of a 5-band stage, Hz: two octaves apart. */
#define OMX_MBC_CROSSOVER_DEFAULTS_5_INIT { 100.0f, 400.0f, 1600.0f, 6400.0f }
#endif
