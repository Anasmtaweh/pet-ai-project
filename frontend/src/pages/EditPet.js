import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Form from 'react-bootstrap/Form';
import Button from 'react-bootstrap/Button';
import Container from 'react-bootstrap/Container';
import { useNavigate, useParams } from 'react-router-dom';
import styles from './EditPet.module.css';
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
    const [breed, setBreed] = useState('');
    const [medicalInfo, setMedicalInfo] = useState('');
    const [pictures, setPictures] = useState([]);
    const [error, setError] = useState('');
    const [isOtherBreed, setIsOtherBreed] = useState(false);
    const navigate = useNavigate();
    const { petId } = useParams();

    const dogBreeds = [
        "Labrador Retriever", "German Shepherd", "Golden Retriever", "French Bulldog",
        "Bulldog", "Poodle", "Beagle", "Rottweiler", "Yorkshire Terrier", "Dachshund",
        "Boxer", "Siberian Husky", "Shih Tzu", "Great Dane", "Doberman Pinscher",
        "Australian Shepherd", "Cavalier King Charles Spaniel", "Pembroke Welsh Corgi",
        "Chihuahua", "Bernese Mountain Dog"
    ];

    const catBreeds = [
        "Persian", "Maine Coon", "Ragdoll", "Siamese", "British Shorthair",
        "Bengal", "Sphynx", "Abyssinian", "Scottish Fold", "Russian Blue",
        "American Shorthair", "Norwegian Forest Cat", "Devon Rex", "Birman",
        "Oriental Shorthair", "Exotic Shorthair", "Tonkinese", "Burmese",
        "Siberian", "Cornish Rex"
    ];

    useEffect(() => {
        const fetchPet = async () => {
            try {
                const response = await axios.get(`http://localhost:3001/pets/${petId}`);
                const petData = response.data;
                setName(petData.name);
                setAgeYears(petData.ageYears);
                setAgeMonths(petData.ageMonths);
                setWeight(petData.weight);
                setSpecies(petData.species);
                setBreed(petData.breed);
                setMedicalInfo(petData.medicalInfo);
                setPictures(petData.pictures || []);
                setIsOtherBreed(petData.breed === 'other');
            } catch (error) {
                console.error('Error fetching pet:', error);
                setError('Error fetching pet data');
            }
        };

        fetchPet();
    }, [petId]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (ageMonths > 11) {
            setError('Age in months must be 11 or less');
            return;
        }
        if (species === 'Dog' && !isOtherBreed && breed === '') {
            setError('Please select a breed.');
            return;
        }
        if (species === 'Cat' && !isOtherBreed && breed === '') {
            setError('Please select a breed.');
            return;
        }
        if (species !== 'Dog' && species !== 'Cat' && breed === '') {
            setError('Please enter a breed.');
            return;
        }

        try {
            const token = localStorage.getItem('token');
            const petData = {
                name,
                ageYears,
                ageMonths,
                weight,
                species,
                breed,
                medicalInfo,
                pictures,
            };

            await axios.put(`http://localhost:3001/pets/${petId}`, petData, {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });

            console.log('Pet updated successfully');
            navigate('/petprofile');
        } catch (err) {
            console.error('Error updating pet:', err.response?.data || err.message);
            setError(err.response?.data?.message || 'An error occurred');
        }
    };
    const handleSpeciesClick = (selectedSpecies) => {
        setSpecies(selectedSpecies);
    };
    const handleBreedChange = (e) => {
        setBreed(e.target.value);
        setIsOtherBreed(e.target.value === 'other');
    };

    return (
        <Container className={`${styles.editPetContainer} mt-5`}>
            <h1 className={styles.editPetTitle}>Edit Pet</h1>
            {error && <div className="alert alert-danger">{error}</div>}
            <Form onSubmit={handleSubmit}>
                <Form.Group className="mb-3">
                    <Form.Label className={styles.formLabel}>Name</Form.Label>
                    <Form.Control className={styles.formControl} type="text" value={name} onChange={(e) => setName(e.target.value)} required />
                </Form.Group>
                <Form.Group className="mb-3">
                    <Form.Label className={styles.formLabel}>Age (Years)</Form.Label>
                    <Form.Control className={styles.formControl} type="number" value={ageYears} onChange={(e) => setAgeYears(e.target.value)} required min="0" />
                </Form.Group>
                <Form.Group className="mb-3">
                    <Form.Label className={styles.formLabel}>Age (Months)</Form.Label>
                    <Form.Control className={styles.formControl} type="number" value={ageMonths} onChange={(e) => setAgeMonths(e.target.value)} required min="0" max="11" />
                </Form.Group>
                <Form.Group className="mb-3">
                    <Form.Label className={styles.formLabel}>Weight (kg)</Form.Label>
                    <Form.Control className={styles.formControl} type="number" value={weight} onChange={(e) => setWeight(e.target.value)} required min="0" />
                </Form.Group>
                <Form.Group className="mb-3">
                    <Form.Label className={styles.formLabel}>Species</Form.Label>
                    <div className={styles.speciesSelection}>
                        <div
                            className={`${styles.speciesOption} ${species === 'Cat' ? styles.selected : ''}`}
                            onClick={() => handleSpeciesClick('Cat')}
                        >
                            <FaCat className={styles.speciesIcon} aria-label="Cat" />
                        </div>
                        <div
                            className={`${styles.speciesOption} ${species === 'Dog' ? styles.selected : ''}`}
                            onClick={() => handleSpeciesClick('Dog')}
                        >
                            <FaDog className={styles.speciesIcon} aria-label="Dog" />
                        </div>
                    </div>
                </Form.Group>
                {species === 'Dog' && (
                    <Form.Group className="mb-3">
                        <Form.Label className={styles.formLabel}>Breed</Form.Label>
                        <Form.Select className={styles.formControl} value={breed} onChange={handleBreedChange} required={!isOtherBreed}>
                            <option value="">Select...</option>
                            {dogBreeds.map((breedName) => (
                                <option key={breedName} value={breedName}>{breedName}</option>
                            ))}
                            <option value="other">Other (Please Specify)</option>
                        </Form.Select>
                    </Form.Group>
                )}
                {species === 'Cat' && (
                    <Form.Group className="mb-3">
                        <Form.Label className={styles.formLabel}>Breed</Form.Label>
                        <Form.Select className={styles.formControl} value={breed} onChange={handleBreedChange} required={!isOtherBreed}>
                            <option value="">Select...</option>
                            {catBreeds.map((breedName) => (
                                <option key={breedName} value={breedName}>{breedName}</option>
                            ))}
                            <option value="other">Other (Please Specify)</option>
                        </Form.Select>
                    </Form.Group>
                )}
                {(species === 'Dog' || species === 'Cat') && isOtherBreed && (
                    <Form.Group className="mb-3">
                        <Form.Control className={styles.formControl} type="text" placeholder="Enter Breed" value={breed} onChange={(e) => setBreed(e.target.value)} required />
                    </Form.Group>
                )}
                {species !== 'Dog' && species !== 'Cat' && (
                    <Form.Group className="mb-3">
                        <Form.Label className={styles.formLabel}>Breed</Form.Label>
                        <Form.Control className={styles.formControl} type="text" value={breed} onChange={(e) => setBreed(e.target.value)} required />
                    </Form.Group>
                )}
                <Form.Group className="mb-3">
                    <Form.Label className={styles.formLabel}>Medical Information</Form.Label>
                    <Form.Control className={styles.formControl} as="textarea" value={medicalInfo} onChange={(e) => setMedicalInfo(e.target.value)} />
                </Form.Group>
                <Form.Group className="mb-3">
                    <Form.Label className={styles.formLabel}>Pictures (Optional)</Form.Label>
                    <Form.Control className={styles.formControl} type="file" multiple onChange={(e) => setPictures(Array.from(e.target.files))} />
                </Form.Group>
                <Button className={styles.editPetButton} variant="primary" type="submit">
                    Save Changes
                </Button>
            </Form>
        </Container>
    );
}

export default EditPet;
