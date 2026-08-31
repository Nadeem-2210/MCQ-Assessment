/**
 * Option Randomizer
 * 
 * This module handles shuffling answer options for each question while
 * maintaining a mapping to track the original correct answer.
 */

export type OptionKey = 'A' | 'B' | 'C' | 'D';

export interface ShuffledOption {
  key: OptionKey;           // The display key (A, B, C, D)
  originalKey: OptionKey;   // The original key before shuffling
  text: string;             // The option text
}

export interface ShuffledQuestion {
  questionId: string;
  options: ShuffledOption[];
  // Map from display key to original key
  keyMap: Record<OptionKey, OptionKey>;
  // Map from original key to display key (for reverse lookup)
  reverseKeyMap: Record<OptionKey, OptionKey>;
}

/**
 * Seeded random number generator for consistent shuffling per trainee
 * Uses a simple mulberry32 algorithm
 */
function seededRandom(seed: number): () => number {
  return function() {
    let t = seed += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

/**
 * Create a numeric seed from a string (attempt ID + question ID)
 */
function stringToSeed(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash);
}

/**
 * Fisher-Yates shuffle with seeded random
 */
function shuffleArray<T>(array: T[], random: () => number): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * Shuffle options for a single question
 * Uses attemptId + questionId as seed for consistent ordering per trainee
 */
export function shuffleQuestionOptions(
  questionId: string,
  attemptId: string,
  options: { a: string; b: string; c: string; d: string }
): ShuffledQuestion {
  // Create seed from attemptId + questionId for consistent shuffling
  const seed = stringToSeed(`${attemptId}-${questionId}`);
  const random = seededRandom(seed);
  
  // Original options with their keys
  const originalOptions: { key: OptionKey; text: string }[] = [
    { key: 'A', text: options.a },
    { key: 'B', text: options.b },
    { key: 'C', text: options.c },
    { key: 'D', text: options.d },
  ];
  
  // Shuffle the options
  const shuffled = shuffleArray(originalOptions, random);
  
  // Create the display options with new keys
  const displayKeys: OptionKey[] = ['A', 'B', 'C', 'D'];
  const shuffledOptions: ShuffledOption[] = shuffled.map((opt, index) => ({
    key: displayKeys[index],
    originalKey: opt.key,
    text: opt.text,
  }));
  
  // Create key mappings
  const keyMap: Record<OptionKey, OptionKey> = {} as Record<OptionKey, OptionKey>;
  const reverseKeyMap: Record<OptionKey, OptionKey> = {} as Record<OptionKey, OptionKey>;
  
  shuffledOptions.forEach(opt => {
    keyMap[opt.key] = opt.originalKey;
    reverseKeyMap[opt.originalKey] = opt.key;
  });
  
  return {
    questionId,
    options: shuffledOptions,
    keyMap,
    reverseKeyMap,
  };
}

/**
 * Convert a display answer back to the original answer
 * Used when submitting to ensure correct scoring
 */
export function mapDisplayAnswerToOriginal(
  displayAnswer: OptionKey,
  shuffledQuestion: ShuffledQuestion
): OptionKey {
  return shuffledQuestion.keyMap[displayAnswer];
}

/**
 * Convert an original answer to display answer
 * Used if we need to show a previously saved answer
 */
export function mapOriginalAnswerToDisplay(
  originalAnswer: OptionKey,
  shuffledQuestion: ShuffledQuestion
): OptionKey {
  return shuffledQuestion.reverseKeyMap[originalAnswer];
}
