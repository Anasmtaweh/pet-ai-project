import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Form from 'react-bootstrap/Form';
import Button from 'react-bootstrap/Button';
import Container from 'react-bootstrap/Container';
import { useNavigate, useParams } from 'react-router-dom';
import styles from './EditPet.module.css'; // Ensure this path is correct
import { FaCat, FaDog } from 'react-icons/fa';

function EditPet() {
    useEffect(() => {
        document.title = "MISHTIKA - Edit Pet";
    }, []);

    const [name, setName] = useState('');
    const [ageYears, setAgeYears] = useState('');
    const [ageMonths, setAgeMonths] = useState('');
    const [weight, setWeight] = useState('');
    const [species, setSpecies] = useState('');
    const [breed, setBreed] = useState(''); // This will hold the actual breed name (standard or custom)
    const [medicalInfo, setMedicalInfo] = useState('');
    const [gender, setGender] = useState('');
    const [error, setError] = useState('');

    const [isOtherBreed, setIsOtherBreed] = useState(false);


    const [currentPictureUrl, setCurrentPictureUrl] = useState(''); // To display current or new preview
    const [newPictureFile, setNewPictureFile] = useState(null);   // To hold the new file object

    const navigate = useNavigate();
    const { petId } = useParams();
    const token = localStorage.getItem('token');

    const dogBreeds = [
        "Labrador Retriever", "German Shepherd", "Golden Retriever", "French Bulldog",
        "Bulldog", "Poodle", "Beagle", "Rottweiler", "Yorkshire Terrier", "Dachshund",
        "Boxer", "Siberian Husky", "Shih Tzu", "Great Dane", "Doberman Pinscher",
        "Australian Shepherd", "Cavalier King Charles Spaniel", "Pembroke Welsh Corgi",
        "Chihuahua", "Bernese Mountain Dog", "Other"
    ];

    const catBreeds = [
        "Persian", "Maine Coon", "Ragdoll", "Siamese", "British Shorthair",
        "Bengal", "Sphynx", "Abyssinian", "Scottish Fold", "Russian Blue",
        "American Shorthair", "Norwegian Forest Cat", "Devon Rex", "Birman",
        "Oriental Shorthair", "Exotic Shorthair", "Tonkinese", "Burmese",
        "Siberian", "Cornish Rex", "Other"
    ];

    useEffect(() => {
        const fetchPet = async () => {
            if (!petId || !token) return;
            try {
                const response = await axios.get(`https://mishtika.duckdns.org/pets/${petId}`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                const petData = response.data;
                setName(petData.name || '');
                setAgeYears(petData.ageYears !== undefined ? String(petData.ageYears) : '');
                setAgeMonths(petData.ageMonths !== undefined ? String(petData.ageMonths) : '');
                setWeight(petData.weight !== undefined ? String(petData.weight) : '');
                setSpecies(petData.species || '');
                setGender(petData.gender || '');
                setMedicalInfo(petData.medicalInfo || '');
                setCurrentPictureUrl(petData.pictures && petData.pictures.length > 0 ? petData.pictures[0] : '');

                // Breed handling
                const fetchedBreed = petData.breed || '';
                const knownBreedsList = petData.species === 'Dog' ? dogBreeds : catBreeds;
                // Check if the fetched breed is NOT in the standard list (excluding "Other" itself)
                const isFetchedBreedCustom = fetchedBreed && !knownBreedsList.slice(0, -1).includes(fetchedBreed);

                setBreed(fetchedBreed); // Store the actual breed name
                setIsOtherBreed(isFetchedBreedCustom); // Set true if it's a custom breed

            } catch (error) {
                console.error('Error fetching pet:', error.response?.data || error.message);
                setError('Error fetching pet data. Please try again.');
            }
        };

        fetchPet();
    }, [petId, token]); // species is not needed here as it's set from petData

    const handleNewPictureChange = (e) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setNewPictureFile(file);
            // Display a preview of the new image
            const reader = new FileReader();
            reader.onloadend = () => {
                setCurrentPictureUrl(reader.result); // Show new image preview
            };
            reader.readAsDataURL(file);
        } else {
            setNewPictureFile(null);

        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        // --- Client-side Validations ---
        if (!name.trim()) { setError('Pet name is required.'); return; }
        const numAgeYears = Number(ageYears);
        const numAgeMonths = Number(ageMonths);
        const numWeight = Number(weight);

        if (isNaN(numAgeYears) || numAgeYears < 0 || numAgeYears > 50) { setError('Valid age in years (0-50) is required.'); return; }
        if (isNaN(numAgeMonths) || numAgeMonths < 0 || numAgeMonths > 11) { setError('Valid age in months (0-11) is required.'); return; }
        if (isNaN(numWeight) || numWeight <= 0 || numWeight > 200) { setError('Valid weight (0.1-200 kg) is required.'); return; }
        if (!gender) { setError('Please select a gender.'); return; }
        if (!species) { setError('Please select a species.'); return; }
        if (!breed.trim()) { setError('Breed is required.'); return; } // `breed` will hold custom or standard
        // --- End Validations ---

        try {
            const formData = new FormData();
            formData.append('name', name.trim());
            formData.append('ageYears', String(numAgeYears));
            formData.append('ageMonths', String(numAgeMonths));
            formData.append('weight', String(numWeight));
            formData.append('species', species);
            formData.append('gender', gender);
            formData.append('breed', breed.trim()); // Send the actual breed name
            formData.append('medicalInfo', medicalInfo.trim());

            if (newPictureFile) {
                formData.append('picture', newPictureFile); // Key 'picture' must match backend
            }

            await axios.put(`https://mishtika.duckdns.org/pets/${petId}`, formData, {
                headers: {
                    Authorization: `Bearer ${token}`,
                    // 'Content-Type': 'multipart/form-data' // Axios sets this automatically for FormData
                },
            });

            console.log('Pet updated successfully');
            navigate('/petprofile'); // Or wherever you want to redirect
        } catch (err) {
            console.error('Error updating pet:', err.response?.data || err.message);
            let errorMsg = 'An error occurred while updating the pet.';
            if (err.response?.data?.message) {
                errorMsg = err.response.data.message;
            } else if (err.response?.data?.details) { // For validation errors from backend
                const details = err.response.data.details;
                errorMsg = Object.values(details).map(detail => detail.message).join(' ');
            }
            setError(errorMsg);
        }
    };

    const handleSpeciesClick = (selectedSpecies) => {
        if (species !== selectedSpecies) {
            setSpecies(selectedSpecies);
            setBreed(''); // Reset breed when species changes
            setIsOtherBreed(false);
        }
    };

    // Handles changes from the Breed <Form.Select>
    const handleBreedDropdownChange = (e) => {
        const selectedValue = e.target.value;
        if (selectedValue === 'Other') {
            setIsOtherBreed(true);
            setBreed(''); // Clear breed text, user will type in the "Specify Breed" input
        } else {
            setIsOtherBreed(false);
            setBreed(selectedValue); // Set breed to the selected standard breed
        }
    };

    // Handles changes from the "Specify Breed" text input
    const handleOtherBreedTextChange = (e) => {
        setBreed(e.target.value); // Update breed with custom text
    };

    const handleGenderChange = (e) => { setGender(e.target.value); };

    const currentBreedList = species === 'Dog' ? dogBreeds : catBreeds;

    return (
        <Container className={`${styles.editPetContainer} mt-5`}>
            <h1 className={styles.editPetTitle}>Edit Pet</h1>
            {error && <div className="alert alert-danger">{error}</div>}
            <Form onSubmit={handleSubmit}>
                {/* Current Picture Preview */}
                {currentPictureUrl && (
                    <Form.Group className="mb-3 text-center">
                        <img src={currentPictureUrl} alt="Current Pet" className={styles.currentPetImage} />
                    </Form.Group>
                )}

                {/* Change Picture Input */}
                <Form.Group className="mb-3">
                    <Form.Label className={styles.formLabel}>Change Picture (Optional)</Form.Label>
                    <Form.Control
                        className={styles.formControl}
                        type="file"
                        name="picture"
                        onChange={handleNewPictureChange}
                        accept="image/jpeg, image/png, image/gif, image/webp"
                    />
                </Form.Group>

                <Form.Group className="mb-3">
                    <Form.Label className={styles.formLabel}>Name</Form.Label>
                    <Form.Control className={styles.formControl} type="text" value={name} onChange={(e) => setName(e.target.value)} required />
                </Form.Group>
                <Form.Group className="mb-3">
                    <Form.Label className={styles.formLabel}>Age (Years)</Form.Label>
                    <Form.Control className={styles.formControl} type="number" value={ageYears} onChange={(e) => setAgeYears(e.target.value)} required min="0" max="50" />
                </Form.Group>
                <Form.Group className="mb-3">
                    <Form.Label className={styles.formLabel}>Age (Months)</Form.Label>
                    <Form.Control className={styles.formControl} type="number" value={ageMonths} onChange={(e) => setAgeMonths(e.target.value)} required min="0" max="11" />
                </Form.Group>
                <Form.Group className="mb-3">
                    <Form.Label className={styles.formLabel}>Weight (kg)</Form.Label>
                    <Form.Control className={styles.formControl} type="number" step="0.1" value={weight} onChange={(e) => setWeight(e.target.value)} required min="0.1" max="200" />
                </Form.Group>

                <Form.Group className="mb-3">
                    <Form.Label className={styles.formLabel}>Gender</Form.Label>
                    <div>
                        <Form.Check inline type="radio" label="Male" name="gender" id="genderMaleEdit" value="Male" checked={gender === 'Male'} onChange={handleGenderChange} required />
                        <Form.Check inline type="radio" label="Female" name="gender" id="genderFemaleEdit" value="Female" checked={gender === 'Female'} onChange={handleGenderChange} required />
                    </div>
                </Form.Group>

                 <Form.Group className="mb-3">
                    <Form.Label className={styles.formLabel}>Species</Form.Label>
                    <div className={styles.speciesSelection}>
                        <div className={`${styles.speciesOption} ${species === 'Cat' ? styles.selected : ''}`} onClick={() => handleSpeciesClick('Cat')}>
                            <FaCat className={styles.speciesIcon} aria-label="Cat" />
                        </div>
                        <div className={`${styles.speciesOption} ${species === 'Dog' ? styles.selected : ''}`} onClick={() => handleSpeciesClick('Dog')}>
                            <FaDog className={styles.speciesIcon} aria-label="Dog" />
                        </div>
                    </div>
                </Form.Group>

                {species && (
                    <Form.Group className="mb-3">
                        <Form.Label className={styles.formLabel}>Breed</Form.Label>
                        <Form.Select
                            className={styles.formControl}
                            value={isOtherBreed ? 'Other' : breed} // Correctly reflects state
                            onChange={handleBreedDropdownChange}
                            required
                        >
                            <option value="">Select {species} Breed...</option>
                            {currentBreedList.map((b) => (
                                <option key={b} value={b}>{b}</option>
                            ))}
                        </Form.Select>
                    </Form.Group>
                )}

                {isOtherBreed && species && (
                    <Form.Group className="mb-3">
                        <Form.Label className={styles.formLabel}>Specify Breed</Form.Label>
                        <Form.Control
                            className={styles.formControl}
                            type="text"
                            placeholder="Enter breed name"
                            value={breed} // Shows the custom breed text from state
                            onChange={handleOtherBreedTextChange}
                            required
                        />
                    </Form.Group>
                )}

                <Form.Group className="mb-3">
                    <Form.Label className={styles.formLabel}>Medical Information (Optional)</Form.Label>
                    <Form.Control className={styles.formControl} as="textarea" rows={3} value={medicalInfo} onChange={(e) => setMedicalInfo(e.target.value)} />
                </Form.Group>

                <Button className={styles.editPetButton} variant="primary" type="submit">
                    Save Changes
                </Button>
            </Form>
        </Container>
    );
}

export default EditPet;