import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useCustomerApi } from '../../hooks/useCustomerApi';
import { BusinessCard } from '../../components/ui/BusinessCard';
import type { BusinessProfile } from '@qulene/api-types';

const CATEGORIES = ['SALON', 'TUTOR', 'CONTRACTOR', 'FITNESS', 'OTHER'] as const;
type Category = (typeof CATEGORIES)[number];

function SkeletonBox({ w, h }: { w: string; h: string }) {
  return <View className={`bg-gray-200 rounded-xl ${w} ${h}`} />;
}

export default function BrowseScreen() {
  const router = useRouter();
  const { fetchBusinesses } = useCustomerApi();

  const [activeCategory, setActiveCategory] = useState<Category | null>(null);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [businesses, setBusinesses] = useState<BusinessProfile[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (category: Category | null, cursor: string | null, append: boolean) => {
      if (append) {
        setIsLoadingMore(true);
      } else {
        setIsLoading(true);
        setError(null);
      }
      try {
        const result = await fetchBusinesses({ category: category ?? undefined, cursor });
        setBusinesses((prev) => (append ? [...prev, ...result.businesses] : result.businesses));
        setNextCursor(result.nextCursor);
      } catch {
        setError('Failed to load businesses.');
      } finally {
        setIsLoading(false);
        setIsLoadingMore(false);
      }
    },
    [fetchBusinesses],
  );

  useEffect(() => {
    load(activeCategory, null, false);
  }, [activeCategory, load]);

  const filteredBusinesses = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return businesses;
    return businesses.filter((b) => b.businessName?.toLowerCase().includes(q));
  }, [businesses, searchQuery]);

  const handleLoadMore = () => {
    if (nextCursor && !isLoadingMore) load(activeCategory, nextCursor, true);
  };

  const selectCategory = (cat: Category | null) => {
    setActiveCategory(cat);
    setShowCategoryPicker(false);
  };

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-white">
      {/* Header */}
      <View className="px-6 pt-2 pb-4">
        <Text className="text-2xl font-bold text-gray-900 mb-3">Browse Businesses</Text>

        {/* Search */}
        <View className="flex-row items-center bg-gray-100 rounded-xl px-3 py-2.5 mb-3">
          <Text className="text-gray-400 mr-2">🔍</Text>
          <TextInput
            className="flex-1 text-sm text-gray-900"
            placeholder="Search businesses…"
            placeholderTextColor="#9ca3af"
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={8}>
              <Text className="text-gray-400 ml-1">✕</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Category dropdown */}
        <TouchableOpacity
          className="flex-row items-center justify-between border border-gray-300 rounded-xl px-4 py-2.5"
          onPress={() => setShowCategoryPicker(true)}
          activeOpacity={0.7}
        >
          <Text className={`text-sm ${activeCategory ? 'text-gray-900 font-medium' : 'text-gray-500'}`}>
            {activeCategory ?? 'All categories'}
          </Text>
          <Text className="text-gray-400 text-xs">▼</Text>
        </TouchableOpacity>
      </View>

      {/* Category picker modal */}
      <Modal visible={showCategoryPicker} transparent animationType="slide" onRequestClose={() => setShowCategoryPicker(false)}>
        <View className="flex-1 bg-black/40 justify-end">
          <Pressable style={{ flex: 1 }} onPress={() => setShowCategoryPicker(false)} />
          <View className="bg-white rounded-t-2xl">
            <View className="flex-row items-center justify-between px-6 pt-5 pb-4 border-b border-gray-100">
              <Text className="text-base font-semibold text-gray-900">Category</Text>
              <TouchableOpacity onPress={() => setShowCategoryPicker(false)}>
                <Text className="text-indigo-600 text-sm font-medium">Done</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              className="flex-row items-center justify-between px-6 py-4 border-b border-gray-100"
              onPress={() => selectCategory(null)}
              activeOpacity={0.7}
            >
              <Text className={`text-sm ${activeCategory === null ? 'text-indigo-600 font-semibold' : 'text-gray-700'}`}>
                All categories
              </Text>
              {activeCategory === null && <Text className="text-indigo-600">✓</Text>}
            </TouchableOpacity>
            {CATEGORIES.map((cat) => (
              <TouchableOpacity
                key={cat}
                className="flex-row items-center justify-between px-6 py-4 border-b border-gray-100"
                onPress={() => selectCategory(cat)}
                activeOpacity={0.7}
              >
                <Text className={`text-sm ${activeCategory === cat ? 'text-indigo-600 font-semibold' : 'text-gray-700'}`}>
                  {cat}
                </Text>
                {activeCategory === cat && <Text className="text-indigo-600">✓</Text>}
              </TouchableOpacity>
            ))}
            <View className="h-8" />
          </View>
        </View>
      </Modal>

      {error && (
        <View className="mx-6 bg-red-50 border border-red-200 rounded-lg px-4 py-3 mb-3">
          <Text className="text-red-700 text-sm">{error}</Text>
        </View>
      )}

      {isLoading ? (
        <ScrollView className="flex-1 px-6">
          {[0, 1, 2, 3].map((i) => (
            <View key={i} className="flex-row items-center mb-4">
              <SkeletonBox w="w-14" h="h-14" />
              <View className="flex-1 ml-4">
                <SkeletonBox w="w-40" h="h-5 mb-2" />
                <SkeletonBox w="w-24" h="h-4" />
              </View>
            </View>
          ))}
        </ScrollView>
      ) : (
        <ScrollView className="flex-1 px-6">
          {filteredBusinesses.length === 0 ? (
            <View className="items-center py-20">
              <Text className="text-4xl mb-4">🏙️</Text>
              <Text className="text-lg font-semibold text-gray-900 mb-1">No businesses found</Text>
              <Text className="text-sm text-gray-500 text-center">
                {searchQuery
                  ? 'Try a different search term.'
                  : activeCategory
                  ? `No ${activeCategory} businesses found. Try a different category.`
                  : 'Check back soon as businesses join Qulene.'}
              </Text>
            </View>
          ) : (
            <>
              {filteredBusinesses.map((biz) => (
                <BusinessCard
                  key={biz.businessId}
                  business={biz}
                  onPress={() => router.push({ pathname: '/(customer)/business/[id]', params: { id: biz.businessId } })}
                />
              ))}
              {nextCursor && !searchQuery ? (
                <TouchableOpacity
                  className="items-center py-4 mb-8"
                  onPress={handleLoadMore}
                  disabled={isLoadingMore}
                >
                  {isLoadingMore ? (
                    <ActivityIndicator color="#4f46e5" />
                  ) : (
                    <Text className="text-indigo-600 font-medium">Load more</Text>
                  )}
                </TouchableOpacity>
              ) : (
                <View className="h-8" />
              )}
            </>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
