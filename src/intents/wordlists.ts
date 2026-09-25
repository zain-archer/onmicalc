/**
 * Two plain word lists.
 *
 * `EVERYDAY_FILLER` is the glue the scorer ignores when comparing a request
 * with a capability's examples. `COMMON_ENGLISH` protects ordinary words from
 * the typo corrector, so "I want to know" is never "corrected" into "watt".
 */

export const EVERYDAY_FILLER: ReadonlySet<string> = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'but', 'by', 'can', 'could', 'did', 'do', 'does', 'for',
  'from', 'get', 'give', 'had', 'has', 'have', 'how', 'i', 'if', 'in', 'into', 'is', 'it', 'its',
  'me', 'my', 'need', 'of', 'on', 'or', 'our', 'out', 'please', 'show', 'so', 'tell', 'than', 'that',
  'the', 'then', 'there', 'these', 'they', 'this', 'to', 'up', 'us', 'want', 'was', 'we', 'were',
  'what', 'when', 'where', 'which', 'who', 'why', 'will', 'with', 'would', 'you', 'your',
]);

const WORDS = [
  'able', 'about', 'above', 'add', 'after', 'again', 'against', 'all', 'almost', 'along', 'already',
  'also', 'although', 'always', 'am', 'among', 'amount', 'another', 'any', 'anyone', 'anything',
  'around', 'ask', 'asked', 'away', 'back', 'because', 'been', 'before', 'being', 'below', 'best',
  'better', 'between', 'both', 'bring', 'call', 'called', 'came', 'case', 'check', 'come', 'consider',
  'correct', 'day', 'days', 'different', 'done', 'down', 'each', 'early', 'either', 'else', 'end',
  'enough', 'even', 'ever', 'every', 'everyone', 'everything', 'exactly', 'example', 'few', 'find',
  'first', 'following', 'found', 'full', 'further', 'gave', 'general', 'go', 'going', 'gone', 'good',
  'got', 'great', 'guess', 'hand', 'happen', 'has', 'help', 'here', 'high', 'him', 'his', 'imagine',
  'important', 'inside', 'interest', 'item', 'just', 'keep', 'kind', 'know', 'known', 'large', 'last',
  'later', 'least', 'leave', 'left', 'less', 'let', 'life', 'like', 'little', 'long', 'look', 'looking',
  'made', 'make', 'many', 'may', 'maybe', 'mean', 'might', 'more', 'most', 'move', 'much', 'must',
  'name', 'near', 'need', 'never', 'new', 'next', 'nice', 'no', 'none', 'nor', 'not', 'nothing',
  'now', 'number', 'often', 'ok', 'okay', 'old', 'once', 'one', 'only', 'open', 'other', 'over',
  'own', 'part', 'people', 'perhaps', 'person', 'place', 'please', 'point', 'pretty', 'probably',
  'problem', 'put', 'question', 'quite', 'rather', 'really', 'right', 'roughly', 'round', 'run',
  'said', 'same', 'say', 'second', 'see', 'seem', 'seen', 'she', 'should', 'show', 'shown', 'side',
  'simple', 'since', 'small', 'some', 'someone', 'something', 'sometimes', 'sorry', 'start', 'still',
  'such', 'sure', 'take', 'taken', 'talk', 'tell', 'thanks', 'thing', 'things', 'think', 'third',
  'thought', 'three', 'time', 'times', 'today', 'together', 'tomorrow', 'too', 'top', 'total',
  'toward', 'turn', 'two', 'under', 'understand', 'until', 'use', 'used', 'using', 'usually', 'very',
  'wait', 'way', 'well', 'went', 'whole', 'without', 'work', 'working', 'world', 'worse', 'worst',
  'wrong', 'year', 'years', 'yesterday', 'yet',
];

let cache: Set<string> | null = null;

export function commonEnglishWords(): Set<string> {
  cache ??= new Set([...EVERYDAY_FILLER, ...WORDS]);
  return cache;
}
