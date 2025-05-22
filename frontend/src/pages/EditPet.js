import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Form from 'react-bootstrap/Form';
import Button from 'react-bootstrap/Button';
import Container from 'react-bootstrap/Container';
import { useNavigate, useParams } from 'react-router-dom';
import styles from './EditPet.module.css'; // Ensure this path is correct
import { FaCat, FaDog } from 'react-icons/fa';

// EditPet component for updating existing pet details.
function EditPet() {
    // Effect hook to set the document title when the component mounts.
    useEffect(() => {
        document.title = "MISHTIKA - Edit Pet";
    }, []);

    // State variables for pet form inputs.
    const [name, setName] = useState('');
    const [ageYears, setAgeYears] = useState('');
    const [ageMonths, setAgeMonths] = useState('');
    const [weight, setWeight] = useState('');
    const [species, setSpecies] = useState('');
    const [breed, setBreed] = useState(''); // Holds the actual breed name.
    const [medicalInfo, setMedicalInfo] = useState('');
    const [gender, setGender] = useState('');
    const [error, setError] = useState('');

    // State to manage the 'Other' breed text input visibility.
    const [isOtherBreed, setIsOtherBreed] = useState(false);

    // State for handling picture updates.
    const [currentPictureUrl, setCurrentPictureUrl] = useState(''); // Displays current or new preview.
    const [newPictureFile, setNewPictureFile] = useState(null);   // Holds the new file object to upload.

    // Hooks for navigation and accessing URL parameters.
    const navigate = useNavigate();
    const { petId } = useParams(); // Gets the pet ID from the URL.
    // Retrieves the authentication token from local storage.
    const token = localStorage.getItem('token');

    // Lists of standard dog and cat breeds.
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

    // Effect hook to fetch the existing pet data when the component mounts or petId/token changes.
    useEffect(() => {
        const fetchPet = async () => {
            if (!petId || !token) return; // Ensure ID and token exist before fetching.
            try {
                // API call to get the specific pet's data by ID.
                const response = await axios.get(`https://mishtika.duckdns.org/pets/${petId}`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                const petData = response.data;
                // Populate state variables with fetched data.
                setName(petData.name || '');
                setAgeYears(petData.ageYears !== undefined ? String(petData.ageYears) : '');
                setAgeMonths(petData.ageMonths !== undefined ? String(petData.ageMonths) : '');
                setWeight(petData.weight !== undefined ? String(petData.weight) : '');
                setSpecies(petData.species || '');
                setGender(petData.gender || '');
                setMedicalInfo(petData.medicalInfo || '');
                // Set the current picture URL if available.
                setCurrentPictureUrl(petData.pictures && petData.pictures.length > 0 ? petData.pictures[0] : '');

                // Handle setting the breed and determining if it's a custom 'Other' breed.
                const fetchedBreed = petData.breed || '';
                const knownBreedsList = petData.species === 'Dog' ? dogBreeds : catBreeds;
                // Check if the fetched breed is NOT in the standard list (excluding "Other" itself).
                const isFetchedBreedCustom = fetchedBreed && !knownBreedsList.slice(0, -1).includes(fetchedBreed);

                setBreed(fetchedBreed); // Store the actual breed name.
                setIsOtherBreed(isFetchedBreedCustom); // Set true if it's a custom breed.

            } catch (error) {
                console.error('Error fetching pet:', error.response?.data || error.message);
                setError('Error fetching pet data. Please try again.');
            }
        };

        fetchPet();
    }, [petId, token]); // Re-run effect if petId or token changes.

    // Handler for when a new picture file is selected.
    const handleNewPictureChange = (e) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setNewPictureFile(file); // Store the file object.
            // Display a preview of the newly selected image.
            const reader = new FileReader();
            reader.onloadend = () => {
                setCurrentPictureUrl(reader.result); // Update the preview URL.
            };
            reader.readAsDataURL(file); // Read the file as a data URL for preview.
        } else {
            setNewPictureFile(null);
            // Optionally reset preview to original or empty if file is cleared.
        }
    };

    // Handler for submitting the pet update form.
    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(''); // Clear previous errors.

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
        if (!breed.trim()) { setError('Breed is required.'); return; } // `breed` holds custom or standard name.
        // --- End Validations ---

        try {
            // Create FormData object to send multipart data (including file).
            const formData = new FormData();
            formData.append('name', name.trim());
            formData.append('ageYears', String(numAgeYears)); // Convert numbers back to strings for FormData.
            formData.append('ageMonths', String(numAgeMonths));
            formData.append('weight', String(numWeight));
            formData.append('species', species);
            formData.append('gender', gender);
            formData.append('breed', breed.trim()); // Send the actual breed name.
            formData.append('medicalInfo', medicalInfo.trim());

            // Append the new picture file if one was selected.
            if (newPictureFile) {
                // The key 'picture' MUST match the field name used in multer on the backend (upload.single('picture')).
                formData.append('picture', newPictureFile);
            }

            // API call to update the pet using PUT request with FormData.
            const response = await axios.put(`https://mishtika.duckdns.org/pets/${petId}`, formData, {
                headers: {
                    Authorization: `Bearer ${token}`,
                    // 'Content-Type': 'multipart/form-data' // Axios sets this automatically for FormData.
                },
            });

            console.log('Pet updated successfully', response.data);
            navigate('/petprofile'); // Redirect after successful update.
        } catch (err) {
            console.error('Error updating pet:', err.response?.data || err.message);
            // Handle and display error messages from backend validation or API calls.
            let errorMsg = 'An error occurred while updating the pet.';
            if (err.response?.data?.message) {
                errorMsg = err.response.data.message;
            } else if (err.response?.data?.details) { // For Mongoose validation errors from backend.
                const details = err.response.data.details;
                errorMsg = Object.values(details).map(detail => detail.message).join(' ');
            } else if (err.message) { // Handle network or other errors.
                errorMsg = err.message;
            }
            setError(errorMsg);
        }
    };

    // Handler for species selection buttons.
    const handleSpeciesClick = (selectedSpecies) => {
        if (species !== selectedSpecies) { // Only update if species is changing.
            setSpecies(selectedSpecies);
            setBreed(''); // Reset breed when species changes.
            setIsOtherBreed(false); // Reset 'Other' breed state.
        }
    };

    // Handler for changes in the standard Breed <Form.Select> dropdown.
    const handleBreedDropdownChange = (e) => {
        const selectedValue = e.target.value;
        if (selectedValue === 'Other') {
            setIsOtherBreed(true);
            setBreed(''); // Clear breed state, user will type in the "Specify Breed" input.
        } else {
            setIsOtherBreed(false);
            setBreed(selectedValue); // Set breed to the selected standard breed name.
        }
    };

    // Handler for changes in the "Specify Breed" text input (when 'Other' is selected).
    const handleOtherBreedTextChange = (e) => {
        setBreed(e.target.value); // Update breed state with the custom text.
    };

    // Handler for gender radio button changes.
    const handleGenderChange = (e) => { setGender(e.target.value); };

    // Determines the correct list of standard breeds based on the selected species.
    const currentBreedList = species === 'Dog' ? dogBreeds : catBreeds;

    // Renders the pet editing form.
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
                        name="picture" // Name attribute MUST match multer field name ('picture').
                        onChange={handleNewPictureChange}
                        accept="image/jpeg, image/png, image/gif, image/webp" // Specify accepted file types.
                    />
                </Form.Group>

                {/* Form fields for pet details */}
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

                {/* Gender Selection */}
                <Form.Group className="mb-3">
                    <Form.Label className={styles.formLabel}>Gender</Form.Label>
                    <div>
                        <Form.Check inline type="radio" label="Male" name="gender" id="genderMaleEdit" value="Male" checked={gender === 'Male'} onChange={handleGenderChange} required />
                        <Form.Check inline type="radio" label="Female" name="gender" id="genderFemaleEdit" value="Female" checked={gender === 'Female'} onChange={handleGenderChange} required />
                    </div>
                </Form.Group>

                {/* Species Selection Buttons */}
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

                {/* Breed Selection Dropdown (Conditional based on Species) */}
                {species && (
                    <Form.Group className="mb-3">
                        <Form.Label className={styles.formLabel}>Breed</Form.Label>
                        <Form.Select
                            className={styles.formControl}
                            // Value reflects whether 'Other' is selected or the actual breed name.
                            value={isOtherBreed ? 'Other' : breed}
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

                {/* "Specify Breed" Text Input (Conditional if 'Other' is selected) */}
                {isOtherBreed && species && (
                    <Form.Group className="mb-3">
                        <Form.Label className={styles.formLabel}>Specify Breed</Form.Label>
                        <Form.Control
                            className={styles.formControl}
                            type="text"
                            placeholder="Enter breed name"
                            value={breed} // Value is the custom breed text from state.
                            onChange={handleOtherBreedTextChange}
                            required
                        />
                    </Form.Group>
                )}

                {/* Medical Info Textarea */}
                <Form.Group className="mb-3">
                    <Form.Label className={styles.formLabel}>Medical Information (Optional)</Form.Label>
                    <Form.Control className={styles.formControl} as="textarea" rows={3} value={medicalInfo} onChange={(e) => setMedicalInfo(e.target.value)} />
                </Form.Group>

                {/* Submit Button */}
                <Button className={styles.editPetButton} variant="primary" type="submit">
                    Save Changes
                </Button>
            </Form>
        </Container>
    );
}

export default EditPet;
