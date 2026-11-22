-- Limite les nouveaux corpus sans supprimer les imagiers déjà enregistrés.
alter table public.zoo_vocabulary_corpora
  add constraint zoo_vocabulary_max_18_words
  check (jsonb_array_length(words) between 6 and 18) not valid;
