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
