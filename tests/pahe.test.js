import test from "node:test";
import assert from "node:assert/strict";
import { parseMoviePost } from "../lib/pahe.js";

test("parseMoviePost extracts metadata and downloads", () => {
  const movie = parseMoviePost({
    id: 153052,
    link: "https://pahe.ink/the-avengers-2012-bluray-720p-1080p/",
    title: {
      rendered: "The Avengers (2012) BluRay 720p &#038; 1080p",
    },
    excerpt: {
      rendered: "<p>Earth&#039;s mightiest heroes must come together.</p>",
    },
    content: {
      rendered: `
        <div class="imdbwp imdbwp--movie dark">
          <div class="imdbwp__thumb">
            <a class="imdbwp__link" href="http://www.imdb.com/title/tt0848228/">
              <img class="imdbwp__img" src="https://image.test/poster.jpg">
            </a>
          </div>
          <div class="imdbwp__content">
            <div class="imdbwp__header"><span class="imdbwp__title">The Avengers</span> (2012)</div>
            <div class="imdbwp__meta"><span>143 min</span>|<span>Action, Sci-Fi</span>|<span>04 May 2012</span></div>
            <div class="imdbwp__belt"><span class="imdbwp__star">8.0</span></div>
            <div class="imdbwp__footer"><strong>Director:</strong> <span>Joss Whedon</span><br /><strong>Actors:</strong> <span>Robert Downey Jr.</span></div>
          </div>
        </div>
        <div class="box download"><div class="box-inner-block">
          720p x264 | 1.2 GB<br />
          <a href="https://teknoasian.com/a">1F</a>
          <a href="https://teknoasian.com/b">GD</a>
        </div></div>
        <div class="box download"><div class="box-inner-block">
          1080p x264 | 2.4 GB<br />
          <a href="https://teknoasian.com/c">MG</a>
        </div></div>
      `,
    },
  });

  assert.equal(movie.title, "The Avengers (2012) BluRay 720p & 1080p");
  assert.equal(movie.year, "2012");
  assert.equal(movie.runtime, "143 min");
  assert.equal(movie.rating, "8.0");
  assert.equal(movie.director, "Joss Whedon");
  assert.equal(movie.downloads.length, 2);
  assert.equal(movie.downloads[0].heading, "720p x264 | 1.2 GB");
  assert.equal(movie.downloads[0].links[0].label, "1F");
});

test("parseMoviePost splits multi-episode download blocks", () => {
  const movie = parseMoviePost({
    id: 208636,
    link: "https://pahe.ink/sample-series/",
    title: {
      rendered: "Sample Series Season 2 WEB-DL [Episode 3 Added]",
    },
    content: {
      rendered: `
        <div class="box download"><div class="box-inner-block">
          Episode 1 480p x264 | 200 MB 720p x264 | 450 MB 720p x265 | 371 MB
          Source: 2160p.ATV.WEB-DL.DDPA5.1.HEVC-KRATOS 1080p x264 6CH | 0.98 GB 1080p x265 6CH | 716 MB<br />
          <a href="https://teknoasian.com/e1-gd">GD</a>
          <a href="https://teknoasian.com/e1-mg">MG</a>
          Episode 2 480p x264 | 175 MB 720p x264 | 350 MB 720p x265 | 258 MB
          Source: 2160p.ATV.WEB-DL.DDPA5.1.HEVC-FLUX 1080p x264 6CH | 858 MB 1080p x265 6CH | 516 MB<br />
          <a href="https://teknoasian.com/e2-gd">GD</a>
          <a href="https://teknoasian.com/e2-mg">MG</a>
          Episode 3 480p x264 | 150 MB 720p x264 | 300 MB 720p x265 | 260 MB<br />
          <a href="https://teknoasian.com/e3-gd">GD</a>
        </div></div>
      `,
    },
  });

  assert.equal(movie.downloads.length, 3);
  assert.match(movie.downloads[0].heading, /^Episode 1/i);
  assert.match(movie.downloads[1].heading, /^Episode 2/i);
  assert.match(movie.downloads[2].heading, /^Episode 3/i);
  assert.equal(movie.downloads[1].links[1].label, "MG");
  assert.equal(movie.downloads[2].links[0].href, "https://teknoasian.com/e3-gd");
});
