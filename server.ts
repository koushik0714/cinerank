import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import Database from "better-sqlite3";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = new Database("cinerank.db");
const JWT_SECRET = process.env.JWT_SECRET || "cinerank-secret-key-123";

// Initialize Database
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    user_id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE,
    email TEXT UNIQUE,
    password_hash TEXT,
    join_date DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS movies (
    movie_id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT,
    release_year INTEGER,
    poster_url TEXT,
    description TEXT,
    type TEXT DEFAULT 'movie', -- 'movie' or 'series'
    country TEXT DEFAULT 'USA'
  );

  CREATE TABLE IF NOT EXISTS questions (
    question_id INTEGER PRIMARY KEY AUTOINCREMENT,
    movie_id INTEGER,
    question_text TEXT,
    difficulty_level INTEGER,
    option_a TEXT,
    option_b TEXT,
    option_c TEXT,
    option_d TEXT,
    correct_answer TEXT,
    FOREIGN KEY (movie_id) REFERENCES movies(movie_id)
  );

  CREATE TABLE IF NOT EXISTS results (
    result_id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    movie_id INTEGER,
    score INTEGER,
    rank_title TEXT,
    date_attempted DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id),
    FOREIGN KEY (movie_id) REFERENCES movies(movie_id)
  );
`);

// Seed Data Helper
const seedData = () => {
  const movieCount = db.prepare("SELECT COUNT(*) as count FROM movies").get() as { count: number };
  if (movieCount.count === 0) {
    const insertMovie = db.prepare("INSERT INTO movies (title, release_year, poster_url, description, type, country) VALUES (?, ?, ?, ?, ?, ?)");
    const insertQuestion = db.prepare("INSERT INTO questions (movie_id, question_text, difficulty_level, option_a, option_b, option_c, option_d, correct_answer) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");

    // Inception (USA)
    const inceptionId = insertMovie.run("Inception", 2010, "https://images.unsplash.com/photo-1626814026160-2237a95fc5a0?q=80&w=800", "A thief who steals corporate secrets through the use of dream-sharing technology.", "movie", "USA").lastInsertRowid;
    insertQuestion.run(inceptionId, "Who directed Inception?", 1, "Christopher Nolan", "Steven Spielberg", "James Cameron", "Quentin Tarantino", "a");
    insertQuestion.run(inceptionId, "What is the name of the 'kick' used to wake up?", 2, "The Jump", "The Surge", "The Kick", "The Drop", "c");
    insertQuestion.run(inceptionId, "What object does Cobb use as his totem?", 3, "A die", "A chess piece", "A spinning top", "A coin", "c");
    insertQuestion.run(inceptionId, "What is the name of Cobb's wife?", 4, "Ariadne", "Mal", "Saito", "Eames", "b");
    insertQuestion.run(inceptionId, "In which city does the first level of the main heist take place?", 5, "Paris", "Mombasa", "Los Angeles", "Sydney", "c");

    // Parasite (South Korea)
    const parasiteId = insertMovie.run("Parasite", 2019, "https://images.unsplash.com/photo-1594908900066-3f47337549d8?q=80&w=800", "Greed and class discrimination threaten the newly formed symbiotic relationship between the wealthy Park family and the destitute Kim clan.", "movie", "South Korea").lastInsertRowid;
    insertQuestion.run(parasiteId, "Who directed Parasite?", 1, "Bong Joon-ho", "Park Chan-wook", "Kim Jee-woon", "Lee Chang-dong", "a");
    insertQuestion.run(parasiteId, "What is the name of the poor family in the movie?", 2, "The Parks", "The Kims", "The Lees", "The Chois", "b");
    insertQuestion.run(parasiteId, "What is the 'scholar's stone' supposed to bring?", 3, "Wealth", "Health", "Long Life", "Bad Luck", "a");
    insertQuestion.run(parasiteId, "What dish does Mrs. Park ask Chung-sook to make?", 4, "Bibimbap", "Kimchi", "Ram-don (Jjapaguri)", "Bulgogi", "c");
    insertQuestion.run(parasiteId, "Where does the Kim family hide when the Parks return early from their camping trip?", 5, "In the basement", "Under the coffee table", "In the closet", "In the garden", "b");

    // Money Heist (Spain)
    const moneyHeistId = insertMovie.run("Money Heist", 2017, "https://images.unsplash.com/photo-1509248961158-e54f6934749c?q=80&w=800", "An unusual group of robbers attempt to carry out the most perfect robbery in Spanish history - stealing 2.4 billion euros from the Royal Mint of Spain.", "series", "Spain").lastInsertRowid;
    insertQuestion.run(moneyHeistId, "What is the codename of the mastermind behind the heist?", 1, "The Teacher", "The Master", "The Professor", "The Brain", "c");
    insertQuestion.run(moneyHeistId, "Which city is NOT a codename for one of the robbers?", 2, "Tokyo", "Berlin", "Madrid", "Nairobi", "c");
    insertQuestion.run(moneyHeistId, "What mask do the robbers wear?", 3, "Guy Fawkes", "Salvador Dalí", "Pablo Picasso", "Don Quixote", "b");
    insertQuestion.run(moneyHeistId, "What is the name of the song the robbers sing?", 4, "Bella Ciao", "Hallelujah", "Despacito", "La Bamba", "a");
    insertQuestion.run(moneyHeistId, "In which city does the second heist take place?", 5, "Royal Mint", "Bank of Spain", "Prado Museum", "Madrid Stock Exchange", "b");

    // Squid Game (South Korea)
    const squidGameId = insertMovie.run("Squid Game", 2021, "https://images.unsplash.com/photo-1634157703702-3c124b455499?q=80&w=800", "Hundreds of cash-strapped players accept a strange invitation to compete in children's games. Inside, a tempting prize awaits with deadly high stakes.", "series", "South Korea").lastInsertRowid;
    insertQuestion.run(squidGameId, "What is the first game played in the competition?", 1, "Marbles", "Tug of War", "Red Light, Green Light", "Honeycomb", "c");
    insertQuestion.run(squidGameId, "What is the number of the main protagonist, Seong Gi-hun?", 2, "001", "067", "218", "456", "d");
    insertQuestion.run(squidGameId, "What shape is on the masks of the workers with the lowest rank?", 3, "Circle", "Triangle", "Square", "Star", "a");
    insertQuestion.run(squidGameId, "Who is revealed to be the creator of the games?", 4, "The Front Man", "Player 001", "The VIPs", "The Salesman", "b");
    insertQuestion.run(squidGameId, "What is the prize money amount (in Won)?", 5, "10 Billion", "45.6 Billion", "100 Billion", "1 Trillion", "b");

    // RRR (India)
    const rrrId = insertMovie.run("RRR", 2022, "https://images.unsplash.com/photo-1598897349489-3d00888959d1?q=80&w=800", "A fictitious story about two legendary revolutionaries and their journey away from home before they started fighting for their country in 1920s.", "movie", "India").lastInsertRowid;
    insertQuestion.run(rrrId, "Who directed RRR?", 1, "S. S. Rajamouli", "Prashanth Neel", "Mani Ratnam", "Sanjay Leela Bhansali", "a");
    insertQuestion.run(rrrId, "What is the name of the viral dance song from the movie?", 2, "Naatu Naatu", "Jai Ho", "Malhari", "Dola Re Dola", "a");
    insertQuestion.run(rrrId, "Which two real-life revolutionaries is the story based on?", 3, "Gandhi & Nehru", "Alluri Sitarama Raju & Komaram Bheem", "Bhagat Singh & Azad", "Subhash Chandra Bose & Patel", "b");
    insertQuestion.run(rrrId, "What animal does Bheem use in his attack on the British governor's palace?", 4, "Elephants", "Lions and Tigers", "Horses", "Bulls", "b");
    insertQuestion.run(rrrId, "What does the acronym RRR stand for in the original Telugu title?", 5, "Rise Roar Revolt", "Roudram Ranam Rudhiram", "Rage Revenge Redemption", "Royal Rebel Revolution", "b");

    // Dark (Germany)
    const darkId = insertMovie.run("Dark", 2017, "https://images.unsplash.com/photo-1536440136628-849c177e76a1?q=80&w=800", "A family saga with a supernatural twist, set in a German town, where the disappearance of two young children exposes the relationships among four families.", "series", "Germany").lastInsertRowid;
    insertQuestion.run(darkId, "In which fictional German town is the series set?", 1, "Winden", "Darmstadt", "Heidelberg", "Freiburg", "a");
    insertQuestion.run(darkId, "What is the main theme of the series?", 2, "Space Travel", "Time Travel", "Ghost Hunting", "Alien Invasion", "b");
    insertQuestion.run(darkId, "How many years apart are the time cycles?", 3, "10 years", "25 years", "33 years", "50 years", "c");
    insertQuestion.run(darkId, "What is the name of the secret society led by Adam?", 4, "The Travelers", "Sic Mundus Creatus Est", "The Enlightened", "The Watchers", "b");
    insertQuestion.run(darkId, "Who is Jonas Kahnwald's father?", 5, "Ulrich Nielsen", "Mikkel Nielsen", "Peter Doppler", "Egon Tiedemann", "b");
  }
};

seedData();

async function startServer() {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());

  // Auth Middleware - reads from cookie OR Authorization header
  const authenticateToken = (req: any, res: any, next: any) => {
    const token = req.cookies?.cinerank_token ||
      (req.headers['authorization'] && req.headers['authorization'].split(' ')[1]);
    if (!token) return res.sendStatus(401);

    jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
      if (err) return res.sendStatus(403);
      req.user = user;
      next();
    });
  };

  // Helper to set auth cookie
  const setAuthCookie = (res: any, token: string, rememberMe: boolean) => {
    const cookieOptions: any = {
      httpOnly: true,
      sameSite: 'strict',
      path: '/',
    };
    if (rememberMe) {
      cookieOptions.maxAge = 30 * 24 * 60 * 60 * 1000; // 30 days
    }
    // Note: secure: true requires HTTPS, skip in dev
    res.cookie('cinerank_token', token, cookieOptions);
  };

  // API Routes
  app.post("/api/auth/signup", async (req, res) => {
    const { username, email, password, rememberMe } = req.body;
    try {
      const hashedPassword = await bcrypt.hash(password, 10);
      const stmt = db.prepare("INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)");
      const result = stmt.run(username, email, hashedPassword);
      const expiresIn = rememberMe ? '30d' : '24h';
      const token = jwt.sign({ user_id: result.lastInsertRowid, username }, JWT_SECRET, { expiresIn });
      setAuthCookie(res, token, !!rememberMe);
      res.json({ user: { user_id: result.lastInsertRowid, username, email } });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    const { email, password, rememberMe } = req.body;
    const user = db.prepare("SELECT * FROM users WHERE email = ?").get(email) as any;
    if (!user) return res.status(400).json({ error: "User not found" });

    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) return res.status(400).json({ error: "Invalid password" });

    const expiresIn = rememberMe ? '30d' : '24h';
    const token = jwt.sign({ user_id: user.user_id, username: user.username }, JWT_SECRET, { expiresIn });
    setAuthCookie(res, token, !!rememberMe);
    res.json({ user: { user_id: user.user_id, username: user.username, email: user.email } });
  });

  app.post("/api/auth/logout", (req, res) => {
    res.clearCookie('cinerank_token', { path: '/' });
    res.json({ message: 'Logged out successfully' });
  });

  app.get("/api/auth/me", authenticateToken, (req: any, res) => {
    const user = db.prepare("SELECT user_id, username, email, join_date FROM users WHERE user_id = ?").get(req.user.user_id);
    res.json(user);
  });

  app.get("/api/movies", async (req, res) => {
    try {
      const apiKey = process.env.TMDB_API_KEY;
      const search = req.query.search as string;

      if (apiKey) {
        if (search) {
          const url = `https://api.themoviedb.org/3/search/multi?api_key=${apiKey}&language=en-US&query=${encodeURIComponent(search)}`;
          const tmdbRes = await fetch(url);
          const tmdbData = await tmdbRes.json();

          if (tmdbData.results) {
            const mappedMovies = tmdbData.results
              .filter((m: any) => m.media_type === 'movie' || m.media_type === 'tv')
              .map((m: any) => ({
                movie_id: m.id,
                title: m.title || m.name,
                release_year: m.release_date ? parseInt(m.release_date.substring(0, 4)) : (m.first_air_date ? parseInt(m.first_air_date.substring(0, 4)) : null),
                poster_url: m.poster_path ? `https://image.tmdb.org/t/p/w500${m.poster_path}` : null,
                description: m.overview,
                type: m.media_type === 'tv' ? 'series' : 'movie',
                country: m.origin_country ? m.origin_country[0] : 'Unknown'
              }));
            return res.json(mappedMovies);
          }
        } else {
          // Fetch popular movies and series independently to combine them
          const moviesUrl = `https://api.themoviedb.org/3/movie/popular?api_key=${apiKey}&language=en-US&page=1`;
          const seriesUrl = `https://api.themoviedb.org/3/tv/popular?api_key=${apiKey}&language=en-US&page=1`;

          const [moviesRes, seriesRes] = await Promise.all([
            fetch(moviesUrl),
            fetch(seriesUrl)
          ]);

          const moviesData = await moviesRes.json();
          const seriesData = await seriesRes.json();

          let combined = [];
          if (moviesData.results) {
            combined.push(...moviesData.results.map((m: any) => ({
              movie_id: m.id,
              title: m.title,
              release_year: m.release_date ? parseInt(m.release_date.substring(0, 4)) : null,
              poster_url: m.poster_path ? `https://image.tmdb.org/t/p/w500${m.poster_path}` : null,
              description: m.overview,
              type: 'movie',
              country: m.origin_country ? m.origin_country[0] : 'Unknown',
              popularity: m.popularity
            })));
          }

          if (seriesData.results) {
            combined.push(...seriesData.results.map((s: any) => ({
              movie_id: s.id,
              title: s.name,
              release_year: s.first_air_date ? parseInt(s.first_air_date.substring(0, 4)) : null,
              poster_url: s.poster_path ? `https://image.tmdb.org/t/p/w500${s.poster_path}` : null,
              description: s.overview,
              type: 'series',
              country: s.origin_country ? s.origin_country[0] : 'Unknown',
              popularity: s.popularity
            })));
          }

          // Sort combined results by popularity and take the top 40
          combined.sort((a, b) => b.popularity - a.popularity);
          return res.json(combined.slice(0, 40));
        }
      }

      let query = "SELECT * FROM movies";
      let params: any[] = [];
      if (search) {
        query += " WHERE title LIKE ?";
        params.push(`%${search}%`);
      }
      const movies = db.prepare(query).all(...params);
      res.json(movies);
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ error: error.message });
    }
  });

  // Check if user already completed a quiz for this movie
  app.get("/api/quiz/check/:movieId", authenticateToken, (req: any, res) => {
    const existing = db.prepare("SELECT score, rank_title FROM results WHERE user_id = ? AND movie_id = ?")
      .get(req.user.user_id, req.params.movieId) as any;

    if (existing) {
      return res.json({ completed: true, score: existing.score, rank_title: existing.rank_title });
    }
    res.json({ completed: false });
  });

  app.get("/api/quiz/:movieId", authenticateToken, async (req: any, res) => {
    try {
      const movieId = req.params.movieId;
      const questions = db.prepare("SELECT * FROM questions WHERE movie_id = ? ORDER BY difficulty_level ASC").all(movieId);

      if (questions.length > 0) {
        return res.json(questions);
      }

      // If no questions in local DB, attempt to generate them via Gemini!
      const apiKey = process.env.GEMINI_API_KEY;
      const tmdbKey = process.env.TMDB_API_KEY;
      const type = req.query.type === 'series' ? 'tv' : 'movie';

      if (apiKey && tmdbKey) {
        // Fetch movie details to give AI context
        let title = "Unknown Title";
        const tmdbRes = await fetch(`https://api.themoviedb.org/3/${type}/${movieId}?api_key=${tmdbKey}`);

        if (tmdbRes.ok) {
          const data = await tmdbRes.json();
          title = data.title || data.name;
        } else {
          // Fallback if type was somehow mismatched
          const fallbackType = type === 'tv' ? 'movie' : 'tv';
          const fallbackRes = await fetch(`https://api.themoviedb.org/3/${fallbackType}/${movieId}?api_key=${tmdbKey}`);
          if (fallbackRes.ok) {
            const data = await fallbackRes.json();
            title = data.name || data.title;
          }
        }

        const { GoogleGenAI } = await import('@google/genai');
        const ai = new GoogleGenAI({ apiKey });

        const prompt = `Generate 5 trivia questions for the movie or series "${title}".
The questions should increase in difficulty from 1 (Easy) to 5 (Expert/Legendary).
For each question, provide 4 options (a, b, c, d) and indicate the correct option letter.
Respond ONLY with a valid JSON array of 5 objects matching this exact structure:
[
  {
    "question_text": "...",
    "difficulty_level": 1,
    "option_a": "...",
    "option_b": "...",
    "option_c": "...",
    "option_d": "...",
    "correct_answer": "a"
  }
]`;

        const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: prompt
        });

        let resultText = response.text || '';
        if (resultText.includes('\`\`\`json')) {
          resultText = resultText.split('\`\`\`json')[1].split('\`\`\`')[0].trim();
        } else if (resultText.includes('\`\`\`')) {
          resultText = resultText.split('\`\`\`')[1].split('\`\`\`')[0].trim();
        }

        const generatedQuestions = JSON.parse(resultText);

        const movieExists = db.prepare("SELECT 1 FROM movies WHERE movie_id = ?").get(movieId);
        if (!movieExists) {
          db.prepare(`INSERT OR IGNORE INTO movies (movie_id, title) VALUES (?, ?)`).run(movieId, title);
        }

        const insertStmt = db.prepare("INSERT INTO questions (movie_id, question_text, difficulty_level, option_a, option_b, option_c, option_d, correct_answer) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");

        db.transaction(() => {
          for (const q of generatedQuestions) {
            insertStmt.run(movieId, q.question_text, q.difficulty_level, q.option_a, q.option_b, q.option_c, q.option_d, (q.correct_answer || '').toLowerCase().trim());
          }
        })();

        const newQuestions = db.prepare("SELECT * FROM questions WHERE movie_id = ? ORDER BY difficulty_level ASC").all(movieId);
        return res.json(newQuestions);
      }

      res.json([]);
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/quiz/submit", authenticateToken, (req: any, res) => {
    const { movie_id, score } = req.body;
    const user_id = req.user.user_id;

    let rank_title = "Film Bluff";
    if (score === 1) rank_title = "Silver Cinephile";
    else if (score === 2) rank_title = "Gold Cinephile";
    else if (score === 3) rank_title = "Diamond Cinephile";
    else if (score === 4) rank_title = "Grandmaster Cinephile";
    else if (score === 5) rank_title = "Elite Cinephile";

    const existing = db.prepare("SELECT * FROM results WHERE user_id = ? AND movie_id = ?").get(user_id, movie_id) as any;

    let returnedScore = score;

    if (existing) {
      if (score > existing.score) {
        db.prepare("UPDATE results SET score = ?, rank_title = ?, date_attempted = CURRENT_TIMESTAMP WHERE result_id = ?").run(score, rank_title, existing.result_id);
      } else {
        returnedScore = existing.score;
        rank_title = existing.rank_title;
      }
    } else {
      const stmt = db.prepare("INSERT INTO results (user_id, movie_id, score, rank_title) VALUES (?, ?, ?, ?)");
      stmt.run(user_id, movie_id, score, rank_title);
    }

    res.json({ score: returnedScore, rank_title });
  });

  app.get("/api/profile", authenticateToken, (req: any, res) => {
    const user_id = req.user.user_id;
    const stats = db.prepare(`
      SELECT 
        COUNT(*) as total_quizzes,
        MAX(score) as best_score,
        (SELECT rank_title FROM results WHERE user_id = ? ORDER BY score DESC LIMIT 1) as best_rank,
        SUM(CASE WHEN score = 5 THEN 1 ELSE 0 END) as elite_count,
        SUM(CASE WHEN score = 4 THEN 1 ELSE 0 END) as grandmaster_count
      FROM results 
      WHERE user_id = ?
    `).get(user_id, user_id) as any;

    if (stats) {
      stats.elite_count = stats.elite_count || 0;
      stats.grandmaster_count = stats.grandmaster_count || 0;
    }

    const history = db.prepare(`
      SELECT r.*, m.poster_url as movie_poster, m.title as movie_title, m.type as movie_type, m.country as movie_country
      FROM results r 
      JOIN movies m ON r.movie_id = m.movie_id 
      WHERE r.user_id = ? 
      ORDER BY r.date_attempted DESC
    `).all(user_id);

    res.json({ stats, history });
  });

  app.get("/api/leaderboard", (req, res) => {
    const leaderboard = db.prepare(`
      SELECT u.username, SUM(r.score) as total_score, COUNT(r.result_id) as quizzes_played
      FROM users u
      JOIN results r ON u.user_id = r.user_id
      GROUP BY u.user_id
      ORDER BY total_score DESC
      LIMIT 10
    `).all();
    res.json(leaderboard);
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  const PORT = 3000;
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
