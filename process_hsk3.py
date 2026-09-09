import pdfplumber
import csv
import re
from deep_translator import GoogleTranslator
import time

def extract_tone(pinyin):
    p = pinyin.lower()
    if re.search(r'[āēīōūǖ]', p): return 1
    if re.search(r'[áéíóúǘ]', p): return 2
    if re.search(r'[ǎěǐǒǔǚ]', p): return 3
    if re.search(r'[àèìòùǜ]', p): return 4
    return 5

def main():
    pdf_path = "New-HSK-Vocabulary-Level-3.pdf"
    csv_path = "src/lib/data/hsk3_pronunciation.csv"
    
    words = []
    
    print("Extracting text from PDF...")
    with pdfplumber.open(pdf_path) as pdf:
        for page in pdf.pages:
            text = page.extract_text()
            if not text:
                continue
                
            lines = text.split('\n')
            for line in lines:
                # Format: 1 阿姨 āyí noun aunt
                parts = line.strip().split(' ')
                if len(parts) >= 4 and parts[0].isdigit():
                    no = parts[0]
                    word = parts[1]
                    pinyin = parts[2]
                    
                    # Sometimes part of speech is missing or combined, but we know the last parts are english
                    # Look for the english part
                    english_parts = []
                    for p in parts[3:]:
                        if re.search(r'[a-zA-Z]', p) and p not in ['noun', 'verb', 'adjective', 'adverb', 'pronoun', 'classifier', 'preposition', 'conjunction', 'auxiliary', 'number', 'suffix', 'prefix', 'noun、verb', 'verb、noun']:
                            # filter out "(noun)" and things
                            clean_p = re.sub(r'[\(（].*?[\)）]', '', p).strip()
                            if clean_p and clean_p.lower() not in ['noun', 'verb', 'adjective', 'adverb', 'pronoun', 'classifier', 'preposition', 'conjunction', 'auxiliary', 'number', 'suffix', 'prefix']:
                                english_parts.append(p)
                                
                    english = " ".join(english_parts)
                    if not english:
                        english = parts[-1]
                        
                    tone = extract_tone(pinyin)
                    words.append({
                        'word': word,
                        'pinyin': pinyin,
                        'english': english,
                        'tone': tone
                    })

    print(f"Extracted {len(words)} words. Translating...")
    
    translator = GoogleTranslator(source='en', target='th')
    
    # Translate in batches
    batch_size = 50
    for i in range(0, len(words), batch_size):
        batch = words[i:i+batch_size]
        texts = [w['english'] for w in batch]
        
        try:
            translations = translator.translate_batch(texts)
            for j, t in enumerate(translations):
                batch[j]['thai'] = t
        except Exception as e:
            print(f"Translation error at batch {i}: {e}")
            for w in batch:
                w['thai'] = w['english'] # Fallback
                
        print(f"Translated up to {min(i+batch_size, len(words))}/{len(words)}")
        time.sleep(1)

    print("Writing to CSV...")
    with open(csv_path, 'w', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        writer.writerow(['word', 'pinyin', 'tones', 'tone_pattern', 'thai', 'surface_tone_pattern'])
        for w in words:
            writer.writerow([
                w['word'], 
                w['pinyin'], 
                w['tone'], 
                w['tone'], 
                w['thai'], 
                w['tone']
            ])
            
    print("Done!")

if __name__ == "__main__":
    main()
