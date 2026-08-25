import json
import re
import os

# Finde den Ordner heraus, in dem dieses Python-Skript gerade liegt
script_dir = os.path.dirname(os.path.abspath(__file__))

# Verbinde den Ordner-Pfad mit den Dateinamen
INPUT_FILE = os.path.join(script_dir, 'items.jsonl')
OUTPUT_FILE = os.path.join(script_dir, 'items_fixed.jsonl')

# Reguläre Ausdrücke, um die Werte aus den Texten zu extrahieren
# 1. Damage and Healing (Spell Power)
regex_spell_power = re.compile(r"Increases damage and healing done by magical spells and effects by up to (\d+)")
# 2. Pure Healing
regex_heal_power = re.compile(r"Increases healing done by spells? and effects by up to (\d+)")

fixed_count = 0

with open(INPUT_FILE, 'r', encoding='utf-8') as infile, \
     open(OUTPUT_FILE, 'w', encoding='utf-8') as outfile:
    
    for line in infile:
        if not line.strip():
            continue
            
        item = json.loads(line)
        
        # Sicherstellen, dass die nötigen Felder existieren
        if "effects" in item and "custom" in item["effects"]:
            custom_effects = item["effects"]["custom"]
            
            spell_power_val = 0
            pure_heal_val = 0
            found_spell_power = False
            found_pure_heal = False
            
            # Alle Custom-Texte des Items durchsuchen
            for effect_text in custom_effects:
                # Prüfe auf Spell Power (Dmg & Heal)
                match_spell = regex_spell_power.search(effect_text)
                if match_spell:
                    spell_power_val = int(match_spell.group(1))
                    found_spell_power = True
                
                # Prüfe auf reines Healing
                match_heal = regex_heal_power.search(effect_text)
                if match_heal:
                    pure_heal_val = int(match_heal.group(1))
                    found_pure_heal = True
            
            # Wenn BEIDE Effekte auf dem Item sind, berechne healPower neu
            if found_spell_power and found_pure_heal:
                alte_heal_power = item["effects"]["healPower"]
                neue_heal_power = spell_power_val + pure_heal_val
                
                item["effects"]["healPower"] = neue_heal_power
                
                print(f"Item '{item['name']}' (ID: {item['id']}) korrigiert: "
                      f"healPower {alte_heal_power} -> {neue_heal_power}")
                fixed_count += 1
                
        # Das (ggf. korrigierte) Item in die neue Datei schreiben
        outfile.write(json.dumps(item) + '\n')

print(f"\nFertig! Es wurden {fixed_count} Items korrigiert.")
print(f"Die neue Datei wurde als '{OUTPUT_FILE}' gespeichert.")