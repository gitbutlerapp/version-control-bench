import rawData from '../data/results.json';
import type { ResultsData } from '@/lib/types';
import { ResultsApp } from './ResultsApp';

const data = rawData as unknown as ResultsData;

export default function Page() {
  return <ResultsApp data={data} />;
}
