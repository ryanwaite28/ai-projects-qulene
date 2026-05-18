import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
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
        const result = await fetchBusinesses({
          category: category ?? undefined,
          cursor,
        });
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

  const handleCategoryPress = (cat: Category) => {
    setActiveCategory((prev) => (prev === cat ? null : cat));
  };

  const handleLoadMore = () => {
    if (nextCursor && !isLoadingMore) {
      load(activeCategory, nextCursor, true);
    }
  };

  return (
    <View className="flex-1 bg-white">
      <View className="px-6 pt-12 pb-3">
        <Text className="text-2xl font-bold text-gray-900">Browse Businesses</Text>
      </View>

      {/* Category chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        className="px-6 mb-3"
        contentContainerClassName="gap-2"
      >
        {CATEGORIES.map((cat) => (
          <TouchableOpacity
            key={cat}
            onPress={() => handleCategoryPress(cat)}
            className={`px-4 py-1.5 rounded-full border ${
              activeCategory === cat
                ? 'bg-indigo-600 border-indigo-600'
                : 'bg-white border-gray-300'
            }`}
          >
            <Text
              className={`text-sm font-medium ${
                activeCategory === cat ? 'text-white' : 'text-gray-600'
              }`}
            >
              {cat}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {error && (
        <View className="mx-6 bg-red-50 border border-red-200 rounded-lg px-4 py-3 mb-3">
          <Text className="text-red-700 text-sm">{error}</Text>
        </View>
      )}

      {isLoading ? (
        <ScrollView className="flex-1 px-6">
          {[0, 1, 2, 3].map((i) => (
            <View key={i} className="flex-row items-center mb-3">
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
          {businesses.length === 0 ? (
            <View className="items-center py-20">
              <Text className="text-4xl mb-4">🏙️</Text>
              <Text className="text-lg font-semibold text-gray-900 mb-1">No businesses yet</Text>
              <Text className="text-sm text-gray-500 text-center">
                {activeCategory
                  ? `No ${activeCategory} businesses found. Try a different category.`
                  : 'Check back soon as businesses join Qulene.'}
              </Text>
            </View>
          ) : (
            <>
              {businesses.map((biz) => (
                <BusinessCard
                  key={biz.businessId}
                  business={biz}
                  onPress={() =>
                    router.push({
                      pathname: '/(customer)/business/[id]',
                      params: { id: biz.businessId },
                    })
                  }
                />
              ))}
              {nextCursor ? (
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
    </View>
  );
}
