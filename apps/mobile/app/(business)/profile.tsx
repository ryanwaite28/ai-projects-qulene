import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Image,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useBusinessApi } from '../../hooks/useBusinessApi';
import { ApiError } from '../../hooks/useApi';

function SkeletonBox({ w, h }: { w: string; h: string }) {
  return <View className={`bg-gray-200 rounded ${w} ${h}`} />;
}

const FIELDS: { label: string; key: keyof FormState; placeholder: string; multiline?: boolean }[] = [
  { label: 'Business Name', key: 'businessName', placeholder: 'e.g. Sunny Day Spa' },
  { label: 'Category', key: 'category', placeholder: 'e.g. Beauty & Wellness' },
  { label: 'Phone', key: 'phone', placeholder: 'e.g. (555) 123-4567' },
  { label: 'Address', key: 'address', placeholder: 'Street address' },
  { label: 'City', key: 'city', placeholder: 'City' },
  { label: 'State', key: 'state', placeholder: 'e.g. CA' },
  { label: 'Description', key: 'description', placeholder: 'Describe your business...', multiline: true },
];

interface FormState {
  businessName: string;
  category: string;
  description: string;
  address: string;
  city: string;
  state: string;
  phone: string;
}

const EMPTY_FORM: FormState = {
  businessName: '',
  category: '',
  description: '',
  address: '',
  city: '',
  state: '',
  phone: '',
};

export default function ProfileScreen() {
  const { fetchBusinessProfile, updateProfile, requestAvatarUploadUrl } = useBusinessApi();

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);

  const setField = (key: keyof FormState) => (value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const loadProfile = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const profile = await fetchBusinessProfile();
      setForm({
        businessName: profile.businessName ?? '',
        category: profile.category ?? '',
        description: profile.description ?? '',
        address: profile.address ?? '',
        city: profile.city ?? '',
        state: profile.state ?? '',
        phone: profile.phone ?? '',
      });
      setAvatarUrl(profile.avatarUrl);
    } catch (err) {
      if (!(err instanceof ApiError && err.code === 'NOT_FOUND')) {
        setError('Failed to load profile.');
      }
    } finally {
      setIsLoading(false);
    }
  }, [fetchBusinessProfile]);

  useEffect(() => { loadProfile(); }, [loadProfile]);

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);
    setSuccess(null);
    try {
      await updateProfile({
        businessName: form.businessName.trim() || null,
        category: form.category.trim() || null,
        description: form.description.trim() || null,
        address: form.address.trim() || null,
        city: form.city.trim() || null,
        state: form.state.trim() || null,
        phone: form.phone.trim() || null,
      });
      setSuccess('Profile saved successfully.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save profile.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAvatarPress = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission required', 'Allow photo library access to upload an avatar.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (result.canceled || !result.assets[0]) return;

    setIsUploadingAvatar(true);
    setError(null);
    try {
      const { uploadUrl, avatarUrl: newAvatarUrl } = await requestAvatarUploadUrl('image/jpeg');
      const fileRes = await fetch(result.assets[0].uri);
      const blob = await fileRes.blob();
      await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': 'image/jpeg' },
        body: blob,
      });
      await updateProfile({ avatarUrl: newAvatarUrl });
      setAvatarUrl(newAvatarUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Avatar upload failed.');
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  if (isLoading) {
    return (
      <ScrollView className="flex-1 bg-white px-6 pt-12">
        <View className="items-center mb-8">
          <SkeletonBox w="w-20" h="h-20" />
        </View>
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <View key={i} className="mb-4">
            <SkeletonBox w="w-24" h="h-4 mb-2" />
            <SkeletonBox w="w-full" h="h-12" />
          </View>
        ))}
      </ScrollView>
    );
  }

  return (
    <ScrollView className="flex-1 bg-white px-6 pt-12">
      <Text className="text-2xl font-bold text-gray-900 mb-6">Business Profile</Text>

      <View className="items-center mb-8">
        <TouchableOpacity onPress={handleAvatarPress} disabled={isUploadingAvatar}>
          {avatarUrl ? (
            <Image
              source={{ uri: avatarUrl }}
              className="w-20 h-20 rounded-full bg-gray-200"
            />
          ) : (
            <View className="w-20 h-20 rounded-full bg-gray-200 items-center justify-center">
              <Text className="text-3xl text-gray-400">+</Text>
            </View>
          )}
          {isUploadingAvatar && (
            <View className="absolute w-20 h-20 rounded-full bg-black/40 items-center justify-center">
              <ActivityIndicator color="#fff" size="small" />
            </View>
          )}
        </TouchableOpacity>
        <Text className="text-sm text-indigo-600 mt-2">Tap to change photo</Text>
      </View>

      {error && (
        <View className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 mb-4">
          <Text className="text-red-700 text-sm">{error}</Text>
        </View>
      )}
      {success && (
        <View className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 mb-4">
          <Text className="text-green-700 text-sm">{success}</Text>
        </View>
      )}

      {FIELDS.map(({ label, key, placeholder, multiline }) => (
        <View key={key} className="mb-4">
          <Text className="text-sm font-medium text-gray-700 mb-1">{label}</Text>
          <TextInput
            className="border border-gray-300 rounded-lg px-4 py-3 text-base text-gray-900"
            value={form[key]}
            onChangeText={setField(key)}
            placeholder={placeholder}
            multiline={multiline}
            numberOfLines={multiline ? 4 : 1}
            editable={!isSaving}
          />
        </View>
      ))}

      <TouchableOpacity
        className={`rounded-lg py-4 items-center mb-12 ${isSaving ? 'bg-indigo-300' : 'bg-indigo-600'}`}
        onPress={handleSave}
        disabled={isSaving}
      >
        {isSaving ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text className="text-white font-semibold text-base">Save Profile</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}
