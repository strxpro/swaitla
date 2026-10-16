# Aktualizacja Lumo na laptopie — instrukcja dla AI (Claude Code)

Wklej asystentowi AI na laptopie: **„Przeczytaj AKTUALIZACJA_DLA_AI.md i zrób to krok po kroku.”**

## Sytuacja
- Na GitHubie (`origin/main`, github.com/strxpro/swaitla) jest nowe Lumo 5.4: Pokaz → Efekty, Momenty,
  Sceny z efektami (prawy przycisk = nadpisz / zmień nazwę / usuń), Reflektor ręczny z „Popraw celowanie”,
  „Moje światła” (kreator, „Zmień model”, „Ustaw laser”), menu pod prawym przyciskiem na lampach,
  Pomocnik AI z kilkoma darmowymi kluczami, obroty lamp efektowych w pokazie.
- Na tym laptopie jest **poprawka kabla USB-DMX**, której nie ma na GitHubie (nigdy nie była wysłana).
- Na tym laptopie jest **własny `config.json`** (lampy, adresy, port COM) — **nie wolno go zmienić**.

## Cel
Kod z `origin/main` + poprawka kabla z laptopa, ustawienia laptopa bez zmian, wszystko wysłane na GitHub.

## Kroki
1. **Kopia zapasowa całego folderu** (np. spakuj go do `Lumo_laptop_kopia_<data>.zip` obok folderu).
   Do tego czasu nie używaj `git reset --hard`, `git clean`, `git checkout -- .`, `git stash drop`.
2. **Znajdź poprawkę kabla**: `git status`, `git diff`, `git log --oneline origin/main..HEAD`.
   Pomoże też Twoja pamięć / historia rozmów o kablu na tym komputerze. Zapisz w 3–5 punktach, co robi
   (np. wykrywanie adaptera FTDI / Open DMX, port COM, sterownik D2XX, ponowne łączenie).
3. **Zachowaj ustawienia**: skopiuj `config.json` poza folder repo (np. `..\config.laptop.json`).
   Pliki `ai_key.txt` i `audd_key.txt` są w `.gitignore` — git ich nie rusza, nie usuwaj ich.
4. **Zapisz poprawkę na osobnej gałęzi** (bez `config.json`):
   `git switch -c laptop-kabel` → `git add -A -- . ":!config.json"` → `git commit -m "Laptop: poprawka kabla DMX"`
5. **Połącz z nowym kodem**: `git fetch origin` → `git switch -c lumo-merge origin/main` → `git merge laptop-kabel`.
   Konflikty rozwiązuj tak, żeby **zostały obie rzeczy**: wszystkie nowe funkcje z `origin/main` **i** logika
   kabla z laptopa. Nigdy nie wyrzucaj nowych plików z main (`aihelp.py`, `static/helper.js`, `manual.js`,
   `myfx.js`, `rig.js`) ani nowych funkcji (np. `laser_mode`, `aim_fix`, `replace_profile`, `start_mine`).
6. **Przywróć ustawienia laptopa**: skopiuj `..\config.laptop.json` z powrotem jako `config.json`.
   Nowe pola w konfiguracji są opcjonalne — program sam doda wartości domyślne.
7. **Sprawdź**: `.venv\Scripts\python.exe -m unittest discover -s tests` (wszystko OK),
   `node --test tests/test_live_audio.cjs`, potem `run.bat`: stan kabla na górze, lampy na dole,
   strona Pokaz (Momenty, Efekty, Sceny, Reflektor ręczny), przycisk Pomoc.
8. Podnieś numer w pliku `VERSION` (np. `5.4.2`) — wtedy `run.bat` sam zrestartuje starsze Lumo.
9. **Wyślij** (bez `config.json`, bez kluczy): `git status` nie może pokazywać `config.json` do zapisu →
   `git add -A -- . ":!config.json"` → `git commit` → `git switch main` → `git merge --ff-only lumo-merge`
   → `git push origin main`.
10. Na drugim komputerze wystarczy potem `git pull` (jego `config.json` też zostaje bez zmian).

## Zasady
- Ustawienia lamp (`config.json`) każdego komputera zostają na nim — nie wysyłaj ich na GitHub.
- Nie kopiuj starego folderu na nowy kod i nie nadpisuj nowszego kodu starszym.
- Repozytorium jest publiczne: żadnych kluczy (AI, AudD) w commitach.
