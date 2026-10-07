import { analyzeKeyword } from "@/lib/aso/analyze";

const [term = "click counter", country = "us"] = process.argv.slice(2);
analyzeKeyword(term, country).then((a) => {
  console.log({ ...a, topApps: a.topApps.slice(0, 3).map((t) => [t.position, t.name, t.ratingCount, t.downloadsEst, t.mrrEst]) });
});
