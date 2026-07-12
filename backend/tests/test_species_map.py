import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.species_map import classify


def test_genus_only_match():
    info = classify(genus="Tilia")
    assert info is not None
    assert info.category == "tree"
    assert info.fruit_type == "Linden"
    assert (info.season_start, info.season_end) == (6, 6)


def test_binomial_overrides_prunus_genus_fallback():
    # Bare Prunus falls back to Plum; the binomials resolve precisely.
    assert classify(species="Prunus").fruit_type == "Plum"
    assert classify(species="Prunus avium").fruit_type == "Cherry"
    assert classify(species="Prunus cerasus").fruit_type == "Sour cherry"
    assert classify(species="Prunus armeniaca").fruit_type == "Apricot"


def test_cherry_laurel_is_not_mislabelled_as_edible_plum():
    # Regression: bare Prunus falls back to Plum, but the toxic ornamental
    # cherry laurel must not read as an edible fruit tree.
    info = classify(species="Prunus laurocerasus")
    assert info.category == "shrub"
    assert info.fruit_type == "Cherry laurel"


def test_conifers_classify_as_evergreen():
    # Conifers/needled trees get their own evergreen category, distinct from
    # the deciduous "tree" bucket.
    assert classify(genus="Pinus").category == "evergreen"
    assert classify(species="Picea abies").category == "evergreen"
    assert classify(genus="Cedrus").fruit_type == "Cedar"
    assert classify(genus="Cupressus").category == "evergreen"


def test_species_derived_from_binomial_when_no_genus_tag():
    info = classify(species="Morus alba")
    assert info.category == "fruit_tree"
    assert info.fruit_type == "Mulberry"


def test_cultivar_suffix_is_ignored():
    info = classify(species="Malus domestica 'Golden Delicious'")
    assert info.fruit_type == "Apple"


def test_hazard_flagged_only_for_dangerous_hogweed():
    dangerous = classify(species="Heracleum mantegazzianum")
    assert dangerous.hazard is True
    # Common hogweed and unknown Heracleum are not in the vocabulary.
    assert classify(species="Heracleum sphondylium") is None


def test_hazard_genus():
    assert classify(genus="Ambrosia").hazard is True
    assert classify(species="Atropa belladonna").hazard is True


def test_unknown_species_returns_none():
    assert classify(species="Sequoia sempervirens") is None
    assert classify(species="") is None
    assert classify() is None


def test_case_and_whitespace_insensitive():
    assert classify(species="  QUERCUS robur  ").fruit_type == "Oak"
    assert classify(genus="  vitis ").category == "vine"
