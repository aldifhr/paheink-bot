import { getMovieById, searchMovies } from "../lib/pahe.js";

const DEFAULT_QUERIES = [
  "The Gift",
  "Virgin River",
  "Monarch: Legacy of Monsters",
];

function inferKind(title) {
  return /season|episode|eps|complete/i.test(String(title || "")) ? "Series" : "Movie";
}

function summarizeDownloads(downloads) {
  if (!downloads.length) {
    return ["- no download groups parsed"];
  }

  return downloads.slice(0, 5).map((group, index) => {
    const labels = group.links.map((item) => item.label).join(", ") || "-";
    return `${index + 1}. ${group.heading} [${labels}]`;
  });
}

async function inspectQuery(query) {
  const results = await searchMovies(query);
  if (!results.length) {
    return {
      query,
      found: false,
    };
  }

  const selected = await getMovieById(results[0].id);
  return {
    query,
    found: true,
    selected,
    candidateCount: results.length,
  };
}

async function main() {
  const queries = process.argv.slice(2).length ? process.argv.slice(2) : DEFAULT_QUERIES;

  for (const query of queries) {
    console.log(`\n=== ${query} ===`);

    try {
      const result = await inspectQuery(query);
      if (!result.found) {
        console.log("No results");
        continue;
      }

      const movie = result.selected;
      console.log(`Match count : ${result.candidateCount}`);
      console.log(`Title       : ${movie.title}`);
      console.log(`Type        : ${inferKind(movie.title)}`);
      console.log(`Year        : ${movie.year || "-"}`);
      console.log(`IMDb        : ${movie.rating || "-"}`);
      console.log(`Published   : ${movie.publishedAt || "-"}`);
      console.log(`Downloads   : ${movie.downloads.length}`);

      for (const line of summarizeDownloads(movie.downloads)) {
        console.log(`  ${line}`);
      }
    } catch (error) {
      console.log(`Error       : ${error.message}`);
    }
  }
}

await main();
